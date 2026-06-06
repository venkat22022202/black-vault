import { NextRequest, NextResponse } from "next/server";
import { authenticateProxyRequest, ProxyAuthError } from "@/server/services/proxy-auth";
import type { SessionLimits } from "@/server/services/proxy-auth";
import { PROXY_PROVIDERS, type UsageAccumulator } from "@/server/services/proxy-providers";
import { decryptApiKey } from "@/server/services/encryption";
import {
  estimateCost,
  estimateRequestCost,
  extractMaxOutputTokens,
} from "@/server/services/proxy-pricing";
import { reserveBudget, commitSpend } from "@/server/services/budget";
import {
  checkProxyRateLimit,
  checkSessionRpmLimit,
  checkSessionRpdLimit,
  type RateLimitResult,
} from "@/server/services/ratelimit";
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

/** Build rate limit headers from a RateLimitResult */
function rateLimitHeaders(result: RateLimitResult, prefix = "X-RateLimit"): Record<string, string> {
  return {
    [`${prefix}-Limit`]: String(result.limit),
    [`${prefix}-Remaining`]: String(result.remaining),
    [`${prefix}-Reset`]: String(Math.ceil(result.reset / 1000)),
  };
}

/** Build BlackVault metadata headers */
function blackvaultHeaders(
  sessionId: string,
  limits: SessionLimits,
  cost: number,
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-BlackVault-Session": sessionId,
    "X-BlackVault-Requests": String(limits.totalRequests),
    "X-BlackVault-Cost": limits.totalCost.toFixed(6),
  };
  if (limits.maxBudget !== null) {
    const remaining = Math.max(0, limits.maxBudget - limits.totalCost - cost);
    headers["X-BlackVault-Budget-Limit"] = limits.maxBudget.toFixed(4);
    headers["X-BlackVault-Budget-Remaining"] = remaining.toFixed(4);
  }
  if (limits.rateLimitRpm !== null) {
    headers["X-BlackVault-RPM-Limit"] = String(limits.rateLimitRpm);
  }
  if (limits.rateLimitRpd !== null) {
    headers["X-BlackVault-RPD-Limit"] = String(limits.rateLimitRpd);
  }
  if (limits.allowedModels && limits.allowedModels.length > 0) {
    headers["X-BlackVault-Allowed-Models"] = limits.allowedModels.join(",");
  }
  return headers;
}

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

  // Authenticate (also enforces IP allowlist + budget at auth level)
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

  const { session, vaultKey, userId, limits } = authResult;
  const allExtraHeaders: Record<string, string> = {};

  // ── Rate Limiting ──────────────────────────────────────

  // 1. Global rate limit (200 req/min per user)
  const globalRate = await checkProxyRateLimit(userId);
  Object.assign(allExtraHeaders, rateLimitHeaders(globalRate));
  if (!globalRate.allowed) {
    return NextResponse.json(
      { error: "Global rate limit exceeded", retryAfter: globalRate.retryAfter },
      {
        status: 429,
        headers: {
          ...CORS_HEADERS,
          ...allExtraHeaders,
          ...blackvaultHeaders(session.id, limits, 0),
          "Retry-After": String(globalRate.retryAfter),
        },
      }
    );
  }

  // 2. Per-session RPM limit
  if (limits.rateLimitRpm !== null) {
    const sessionRpm = await checkSessionRpmLimit(session.id, limits.rateLimitRpm);
    allExtraHeaders["X-Session-RateLimit-RPM-Limit"] = String(sessionRpm.limit);
    allExtraHeaders["X-Session-RateLimit-RPM-Remaining"] = String(sessionRpm.remaining);
    allExtraHeaders["X-Session-RateLimit-RPM-Reset"] = String(Math.ceil(sessionRpm.reset / 1000));
    if (!sessionRpm.allowed) {
      return NextResponse.json(
        {
          error: "Session rate limit exceeded (RPM)",
          limit: limits.rateLimitRpm,
          retryAfter: sessionRpm.retryAfter,
        },
        {
          status: 429,
          headers: {
            ...CORS_HEADERS,
            ...allExtraHeaders,
            ...blackvaultHeaders(session.id, limits, 0),
            "Retry-After": String(sessionRpm.retryAfter),
          },
        }
      );
    }
  }

  // 3. Per-session RPD limit
  if (limits.rateLimitRpd !== null) {
    const sessionRpd = await checkSessionRpdLimit(session.id, limits.rateLimitRpd);
    allExtraHeaders["X-Session-RateLimit-RPD-Limit"] = String(sessionRpd.limit);
    allExtraHeaders["X-Session-RateLimit-RPD-Remaining"] = String(sessionRpd.remaining);
    if (!sessionRpd.allowed) {
      return NextResponse.json(
        {
          error: "Session daily limit exceeded (RPD)",
          limit: limits.rateLimitRpd,
          retryAfter: sessionRpd.retryAfter,
        },
        {
          status: 429,
          headers: {
            ...CORS_HEADERS,
            ...allExtraHeaders,
            ...blackvaultHeaders(session.id, limits, 0),
            "Retry-After": String(sessionRpd.retryAfter),
          },
        }
      );
    }
  }

  // ── Decrypt the real API key ───────────────────────────

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

  const model = providerConfig.extractModel(parsedBody, path);

  // ── Model Restriction Enforcement ──────────────────────

  if (limits.allowedModels && limits.allowedModels.length > 0 && model) {
    const isAllowed = limits.allowedModels.some(
      (m) => m.toLowerCase() === model.toLowerCase()
    );
    if (!isAllowed) {
      return NextResponse.json(
        {
          error: "Model not allowed for this session",
          requestedModel: model,
          allowedModels: limits.allowedModels,
        },
        {
          status: 403,
          headers: {
            ...CORS_HEADERS,
            ...blackvaultHeaders(session.id, limits, 0),
          },
        }
      );
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

  const isStreaming = parsedBody?.stream === true ||
    path.includes("streamGenerateContent");

  // ── Budget reservation (atomic, real-time) ─────────────
  // Reserve a conservative estimate before forwarding so concurrent requests
  // can't all read a stale spend total and blow past the cap. Reconciled to the
  // actual cost after the response in commitSpend().
  const estimatedCost = estimateRequestCost(
    providerName,
    model,
    body ?? "",
    extractMaxOutputTokens(parsedBody)
  );
  const reservation = await reserveBudget(
    session.id,
    limits.maxBudget,
    limits.totalCost,
    estimatedCost
  );
  if (!reservation.allowed) {
    return NextResponse.json(
      {
        error: "Session budget exhausted",
        limit: limits.maxBudget,
        spent: Number(reservation.spentBefore.toFixed(6)),
      },
      {
        status: 402,
        headers: {
          ...CORS_HEADERS,
          ...allExtraHeaders,
          ...blackvaultHeaders(session.id, limits, 0),
        },
      }
    );
  }

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
    // Refund the reservation — no cost was incurred.
    commitSpend(session.id, reservation.reserved, 0);
    logProxyRequest(session.id, userId, providerName, model, `/${path}`, request.method, 502, 0, 0, 0, latencyMs, request);
    return NextResponse.json(
      { error: "Failed to reach provider", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 502, headers: CORS_HEADERS }
    );
  }

  const statusCode = upstreamResponse.status;

  // Merge CORS + rate limit + BlackVault headers for all responses
  const mergedResponseHeaders = (extraHeaders: Record<string, string> = {}) => {
    const h = new Headers();
    for (const [k, v] of Object.entries(CORS_HEADERS)) h.set(k, v);
    for (const [k, v] of Object.entries(allExtraHeaders)) h.set(k, v);
    for (const [k, v] of Object.entries(extraHeaders)) h.set(k, v);
    return h;
  };

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
            commitSpend(session.id, reservation.reserved, cost);
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

    const responseHeaders = mergedResponseHeaders({
      "Content-Type": upstreamResponse.headers.get("content-type") ?? "text/event-stream",
      "Cache-Control": "no-store",
      ...blackvaultHeaders(session.id, limits, 0),
    });

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

  commitSpend(session.id, reservation.reserved, cost);
  logProxyRequest(session.id, userId, providerName, model, `/${path}`, request.method, statusCode, usage.input, usage.output, totalTokens, latencyMs, request);
  updateSessionCounters(session.id, totalTokens, cost);

  const responseHeaders = mergedResponseHeaders({
    "Content-Type": upstreamResponse.headers.get("content-type") ?? "application/json",
    "Cache-Control": "no-store",
    ...blackvaultHeaders(session.id, limits, cost),
  });

  return new Response(responseBody, {
    status: statusCode,
    headers: responseHeaders,
  });
 } catch (err) {
    return NextResponse.json(
      { error: "Internal proxy error", details: err instanceof Error ? err.message : String(err) },
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
