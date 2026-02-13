import { NextRequest, NextResponse } from "next/server";
import { authenticateProxyRequest, ProxyAuthError } from "@/server/services/proxy-auth";
import { PROXY_PROVIDERS, type UsageAccumulator } from "@/server/services/proxy-providers";
import { decryptApiKey } from "@/server/services/encryption";
import { estimateCost } from "@/server/services/proxy-pricing";
import { checkProxyRateLimit } from "@/server/services/ratelimit";
import { db } from "@/server/db";
import { proxyLogs, proxySessions } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, anthropic-version, x-api-key, x-goog-api-key",
  "Access-Control-Max-Age": "86400",
};

const REQUEST_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// OPTIONS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function handleProxy(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string; path: string[] }> }
) {
 try {
  const startTime = Date.now();
  const { provider: providerName, path: pathSegments } = await params;
  const path = pathSegments.join("/");

  // Validate provider
  const providerConfig = PROXY_PROVIDERS[providerName];
  if (!providerConfig) {
    return NextResponse.json(
      { error: `Unsupported provider: ${providerName}` },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Authenticate
  let authResult;
  try {
    authResult = await authenticateProxyRequest(request);
  } catch (err) {
    if (err instanceof ProxyAuthError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode, headers: CORS_HEADERS }
      );
    }
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const { session, vaultKey, userId } = authResult;

  // Rate limit per user (200 req/min)
  const rateCheck = await checkProxyRateLimit(userId);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateCheck.retryAfter },
      { status: 429, headers: { ...CORS_HEADERS, "Retry-After": String(rateCheck.retryAfter) } }
    );
  }

  // Decrypt the real API key
  let realKey: string;
  try {
    realKey = decryptApiKey(
      vaultKey.encryptedKey,
      vaultKey.iv,
      userId,
      vaultKey.id
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to decrypt API key" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  // DEBUG: Return key metadata (REMOVE AFTER DEBUGGING)
  if (request.headers.get("x-debug") === "1") {
    const keyType = typeof vaultKey.encryptedKey;
    const isBuffer = Buffer.isBuffer(vaultKey.encryptedKey);
    const keyLen = vaultKey.encryptedKey?.length;
    const ivType = typeof vaultKey.iv;
    const ivIsBuffer = Buffer.isBuffer(vaultKey.iv);
    let decryptedPreview = "";
    try {
      const dk = decryptApiKey(vaultKey.encryptedKey, vaultKey.iv, userId, vaultKey.id);
      decryptedPreview = `ok, len=${dk.length}, ascii=${/^[\x20-\x7e]+$/.test(dk)}, first5=${dk.slice(0, 5)}`;
    } catch (e) {
      decryptedPreview = `fail: ${e instanceof Error ? e.message : String(e)}`;
    }
    return NextResponse.json({
      keyType, isBuffer, keyLen, ivType, ivIsBuffer, decryptedPreview,
    }, { headers: CORS_HEADERS });
  }

  // Build upstream URL
  const upstreamUrl = `${providerConfig.baseUrl}/${path}`;

  // Build headers: only forward safe headers, then add provider auth
  const FORWARDED_HEADERS = ["content-type", "accept", "user-agent", "anthropic-version"];
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const providerHeaders = providerConfig.buildHeaders(realKey);
  for (const [k, v] of Object.entries(providerHeaders)) {
    headers.set(k, v);
  }

  // Parse body for model extraction and stream detection
  let body: string | null = null;
  let parsedBody: Record<string, unknown> | null = null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text();
    try {
      parsedBody = JSON.parse(body);
    } catch {
      // Not JSON — pass through as-is
    }
  }

  // For OpenAI streaming, inject stream_options to get usage in final chunk
  if (
    providerName === "openai" &&
    parsedBody?.stream === true &&
    !parsedBody.stream_options
  ) {
    parsedBody.stream_options = { include_usage: true };
    body = JSON.stringify(parsedBody);
  }

  const model = providerConfig.extractModel(parsedBody, path);
  const isStreaming = parsedBody?.stream === true ||
    path.includes("streamGenerateContent");

  // Forward request to provider
  let upstreamResponse: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    logProxyRequest(session.id, userId, providerName, model, `/${path}`, request.method, 502, 0, 0, 0, latencyMs, request);
    return NextResponse.json(
      { error: "Failed to reach provider", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 502, headers: CORS_HEADERS }
    );
  }

  const statusCode = upstreamResponse.status;

  if (isStreaming && upstreamResponse.body) {
    // SSE streaming response
    const acc: UsageAccumulator = { input: 0, output: 0 };
    const reader = upstreamResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            // Process remaining buffer
            if (buffer.trim()) {
              for (const line of buffer.split("\n")) {
                providerConfig.parseStreamChunk(line.trim(), acc);
              }
            }
            controller.close();

            // Log usage after stream ends
            const latencyMs = Date.now() - startTime;
            const totalTokens = acc.input + acc.output;
            const cost = estimateCost(providerName, model, acc.input, acc.output);
            logProxyRequest(session.id, userId, providerName, model, `/${path}`, request.method, statusCode, acc.input, acc.output, totalTokens, latencyMs, request);
            updateSessionCounters(session.id, totalTokens, cost);
            return;
          }

          // Pass through to client
          controller.enqueue(value);

          // Parse SSE lines for usage tracking
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? ""; // Keep incomplete last line in buffer
          for (const line of lines) {
            providerConfig.parseStreamChunk(line.trim(), acc);
          }
        } catch {
          controller.close();
        }
      },
      cancel() {
        reader.cancel();
      },
    });

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", upstreamResponse.headers.get("content-type") ?? "text/event-stream");
    responseHeaders.set("Cache-Control", "no-store");
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      responseHeaders.set(k, v);
    }

    return new Response(stream, {
      status: statusCode,
      headers: responseHeaders,
    });
  }

  // Non-streaming response
  const responseBody = await upstreamResponse.text();
  const latencyMs = Date.now() - startTime;

  let usage = { input: 0, output: 0 };
  try {
    const parsed = JSON.parse(responseBody);
    usage = providerConfig.extractUsage(parsed);
  } catch {
    // Non-JSON or no usage data
  }

  const totalTokens = usage.input + usage.output;
  const cost = estimateCost(providerName, model, usage.input, usage.output);

  logProxyRequest(session.id, userId, providerName, model, `/${path}`, request.method, statusCode, usage.input, usage.output, totalTokens, latencyMs, request);
  updateSessionCounters(session.id, totalTokens, cost);

  const responseHeaders = new Headers();
  responseHeaders.set("Content-Type", upstreamResponse.headers.get("content-type") ?? "application/json");
  responseHeaders.set("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    responseHeaders.set(k, v);
  }

  return new Response(responseBody, {
    status: statusCode,
    headers: responseHeaders,
  });
 } catch (err) {
    return NextResponse.json(
      { error: "Internal proxy error", v: 2, details: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// Fire-and-forget logging
function logProxyRequest(
  sessionId: string,
  userId: string,
  provider: string,
  model: string | null,
  endpoint: string,
  method: string,
  statusCode: number,
  inputTokens: number,
  outputTokens: number,
  totalTokens: number,
  latencyMs: number,
  request: Request
) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;
  const ua = request.headers.get("user-agent") ?? null;
  const cost = estimateCost(provider, model, inputTokens, outputTokens);

  db.insert(proxyLogs)
    .values({
      sessionId,
      userId,
      provider,
      model,
      endpoint,
      method,
      statusCode,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost: cost.toFixed(6),
      latencyMs,
      ipAddress: ip,
      userAgent: ua,
    })
    .then(() => {})
    .catch(() => {});
}

// Fire-and-forget counter update
function updateSessionCounters(
  sessionId: string,
  totalTokens: number,
  cost: number
) {
  db.update(proxySessions)
    .set({
      totalRequests: sql`${proxySessions.totalRequests} + 1`,
      totalTokensUsed: sql`${proxySessions.totalTokensUsed} + ${totalTokens}`,
      totalCost: sql`${proxySessions.totalCost} + ${cost}`,
      updatedAt: new Date(),
    })
    .where(eq(proxySessions.id, sessionId))
    .then(() => {})
    .catch(() => {});
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
export const PATCH = handleProxy;
