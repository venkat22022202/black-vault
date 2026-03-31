import { NextRequest, NextResponse } from "next/server";
import { authenticateProxyRequest, ProxyAuthError } from "@/server/services/proxy-auth";
import type { SessionLimits } from "@/server/services/proxy-auth";
import { PROXY_PROVIDERS } from "@/server/services/proxy-providers";
import { routeModel, getSupportedPrefixes } from "@/server/services/model-router";
import {
  openaiToAnthropic,
  anthropicToOpenai,
  openaiToGoogle,
  googleToOpenai,
  createAnthropicToOpenaiStream,
  createGoogleToOpenaiStream,
} from "@/server/services/format-translator";
import { decryptApiKey } from "@/server/services/encryption";
import { estimateCost } from "@/server/services/proxy-pricing";
import {
  checkProxyRateLimit,
  checkSessionRpmLimit,
  checkSessionRpdLimit,
} from "@/server/services/ratelimit";
import { db } from "@/server/db";
import { proxyLogs, proxySessions, vaultKeys } from "@/server/db/schema";
import { eq, and, sql } from "drizzle-orm";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

const REQUEST_TIMEOUT = 5 * 60 * 1000;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Universal AI Gateway — OpenAI-compatible endpoint.
 *
 * Accepts any model name, auto-routes to the correct provider,
 * translates request/response formats, and returns OpenAI-format responses.
 *
 * Works with: OpenClaw, LangChain, CrewAI, AutoGen, Cursor, Continue,
 * or ANY tool that supports the OpenAI API.
 */
async function handleUniversalChat(request: NextRequest) {
  try {
    const startTime = Date.now();

    // ── Authenticate ─────────────────────────────────────
    let authResult;
    try {
      authResult = await authenticateProxyRequest(request);
    } catch (err) {
      if (err instanceof ProxyAuthError) {
        return NextResponse.json(
          { error: { message: err.message, type: "authentication_error", code: err.statusCode } },
          { status: err.statusCode, headers: CORS_HEADERS }
        );
      }
      return NextResponse.json(
        { error: { message: "Authentication failed", type: "server_error" } },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const { session, vaultKey, userId, limits } = authResult;

    // ── Parse request body ───────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { message: "Invalid JSON body", type: "invalid_request_error" } },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const model = (body.model as string) ?? "";
    if (!model) {
      return NextResponse.json(
        { error: { message: "Missing 'model' field", type: "invalid_request_error" } },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // ── Route model to provider ──────────────────────────
    const route = routeModel(model);
    if (!route) {
      return NextResponse.json(
        {
          error: {
            message: `Cannot route model "${model}" to a provider. Supported prefixes: ${getSupportedPrefixes().join(", ")}`,
            type: "invalid_request_error",
          },
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const targetProvider = route.provider;

    // ── Model restriction check ──────────────────────────
    if (limits.allowedModels && limits.allowedModels.length > 0) {
      const isAllowed = limits.allowedModels.some(
        (m) => m.toLowerCase() === model.toLowerCase()
      );
      if (!isAllowed) {
        return NextResponse.json(
          {
            error: {
              message: `Model "${model}" not allowed for this token. Allowed: ${limits.allowedModels.join(", ")}`,
              type: "invalid_request_error",
              code: "model_not_allowed",
            },
          },
          { status: 403, headers: CORS_HEADERS }
        );
      }
    }

    // ── Rate limiting ────────────────────────────────────
    const globalRate = await checkProxyRateLimit(userId);
    if (!globalRate.allowed) {
      return NextResponse.json(
        { error: { message: "Rate limit exceeded", type: "rate_limit_error" } },
        { status: 429, headers: { ...CORS_HEADERS, "Retry-After": String(globalRate.retryAfter) } }
      );
    }

    if (limits.rateLimitRpm !== null) {
      const rpm = await checkSessionRpmLimit(session.id, limits.rateLimitRpm);
      if (!rpm.allowed) {
        return NextResponse.json(
          { error: { message: `Session RPM limit (${limits.rateLimitRpm}) exceeded`, type: "rate_limit_error" } },
          { status: 429, headers: { ...CORS_HEADERS, "Retry-After": String(rpm.retryAfter) } }
        );
      }
    }

    if (limits.rateLimitRpd !== null) {
      const rpd = await checkSessionRpdLimit(session.id, limits.rateLimitRpd);
      if (!rpd.allowed) {
        return NextResponse.json(
          { error: { message: `Session daily limit (${limits.rateLimitRpd}) exceeded`, type: "rate_limit_error" } },
          { status: 429, headers: { ...CORS_HEADERS, "Retry-After": String(rpd.retryAfter) } }
        );
      }
    }

    // ── Resolve API key ──────────────────────────────────
    // If the token's vault key matches the target provider, use it directly.
    // Otherwise, find another active key from this user for the target provider.
    let resolvedKey = vaultKey;

    if (vaultKey.provider !== targetProvider) {
      const [altKey] = await db
        .select({
          id: vaultKeys.id,
          userId: vaultKeys.userId,
          provider: vaultKeys.provider,
          encryptedKey: vaultKeys.encryptedKey,
          iv: vaultKeys.iv,
          isActive: vaultKeys.isActive,
          monthlyBudget: vaultKeys.monthlyBudget,
        })
        .from(vaultKeys)
        .where(
          and(
            eq(vaultKeys.userId, userId),
            eq(vaultKeys.provider, targetProvider),
            eq(vaultKeys.isActive, true)
          )
        )
        .limit(1);

      if (!altKey) {
        return NextResponse.json(
          {
            error: {
              message: `No active ${targetProvider} API key in your vault. Model "${model}" requires a ${targetProvider} key. Add one at /vault.`,
              type: "invalid_request_error",
              code: "missing_provider_key",
            },
          },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      resolvedKey = {
        ...altKey,
        monthlyBudget: altKey.monthlyBudget ? Number(altKey.monthlyBudget) : null,
      };
    }

    // ── Decrypt API key ──────────────────────────────────
    let realKey: string;
    try {
      realKey = decryptApiKey(resolvedKey.encryptedKey, resolvedKey.iv, userId, resolvedKey.id);
    } catch {
      return NextResponse.json(
        { error: { message: "Failed to decrypt API key", type: "server_error" } },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // ── Build upstream request ───────────────────────────
    const providerConfig = PROXY_PROVIDERS[targetProvider];
    const isStreaming = body.stream === true;
    let upstreamUrl: string;
    let upstreamBody: string;
    const upstreamHeaders = new Headers({ "Content-Type": "application/json" });

    if (targetProvider === "anthropic") {
      // Translate OpenAI → Anthropic
      const translated = openaiToAnthropic(body as Parameters<typeof openaiToAnthropic>[0]);
      upstreamUrl = translated.url;
      upstreamBody = JSON.stringify(translated.body);
      const authHeaders = providerConfig.buildHeaders(realKey);
      for (const [k, v] of Object.entries(authHeaders)) upstreamHeaders.set(k, v);
    } else if (targetProvider === "google") {
      // Translate OpenAI → Google
      const translated = openaiToGoogle(body as Parameters<typeof openaiToGoogle>[0]);
      upstreamUrl = translated.url;
      upstreamBody = JSON.stringify(translated.body);
      const authHeaders = providerConfig.buildHeaders(realKey);
      for (const [k, v] of Object.entries(authHeaders)) upstreamHeaders.set(k, v);
    } else {
      // OpenAI-compatible (OpenAI, Nebius, etc.) — forward as-is
      if (targetProvider === "openai" && isStreaming && !body.stream_options) {
        body.stream_options = { include_usage: true };
      }
      upstreamUrl = `${providerConfig.baseUrl}/v1/chat/completions`;
      upstreamBody = JSON.stringify(body);
      const authHeaders = providerConfig.buildHeaders(realKey);
      for (const [k, v] of Object.entries(authHeaders)) upstreamHeaders.set(k, v);
    }

    // ── Forward to provider ──────────────────────────────
    let upstreamResponse: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      upstreamResponse = await fetch(upstreamUrl, {
        method: "POST",
        headers: upstreamHeaders,
        body: upstreamBody,
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      logRequest(session.id, userId, targetProvider, model, "/v1/chat/completions", 502, 0, 0, latencyMs, request);
      return NextResponse.json(
        { error: { message: "Failed to reach provider", type: "server_error", details: err instanceof Error ? err.message : undefined } },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    const statusCode = upstreamResponse.status;

    // ── BlackVault response headers ──────────────────────
    const bvHeaders: Record<string, string> = {
      "X-BlackVault-Session": session.id,
      "X-BlackVault-Provider": targetProvider,
      "X-BlackVault-Gateway": "universal",
    };
    if (limits.maxBudget !== null) {
      bvHeaders["X-BlackVault-Budget-Remaining"] = Math.max(0, limits.maxBudget - limits.totalCost).toFixed(4);
    }

    // ── Handle streaming ─────────────────────────────────
    if (isStreaming && upstreamResponse.body) {
      const reader = upstreamResponse.body.getReader();
      let outputStream: ReadableStream;
      let getUsage: () => { input: number; output: number };

      if (targetProvider === "anthropic") {
        const result = createAnthropicToOpenaiStream(reader, model);
        outputStream = result.stream;
        getUsage = result.getUsage;
      } else if (targetProvider === "google") {
        const result = createGoogleToOpenaiStream(reader, model);
        outputStream = result.stream;
        getUsage = result.getUsage;
      } else {
        // OpenAI-compatible — pass through, but track usage
        const acc = { input: 0, output: 0 };
        getUsage = () => acc;
        outputStream = new ReadableStream({
          async pull(ctrl) {
            try {
              const { done, value } = await reader.read();
              if (done) { ctrl.close(); return; }
              ctrl.enqueue(value);
              // Parse for usage
              const text = new TextDecoder().decode(value);
              for (const line of text.split("\n")) {
                if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
                try {
                  const d = JSON.parse(line.slice(6));
                  if (d.usage) {
                    acc.input = d.usage.prompt_tokens ?? acc.input;
                    acc.output = d.usage.completion_tokens ?? acc.output;
                  }
                } catch { /* skip */ }
              }
            } catch { ctrl.close(); }
          },
          cancel() { reader.cancel(); },
        });
      }

      // Wrap to log after stream ends
      const wrappedStream = new ReadableStream({
        async start(ctrl) {
          const r = outputStream.getReader();
          try {
            while (true) {
              const { done, value } = await r.read();
              if (done) break;
              ctrl.enqueue(value);
            }
          } catch { /* stream error */ } finally {
            ctrl.close();
            const latencyMs = Date.now() - startTime;
            const u = getUsage();
            const cost = estimateCost(targetProvider, model, u.input, u.output);
            logRequest(session.id, userId, targetProvider, model, "/v1/chat/completions", statusCode, u.input, u.output, latencyMs, request);
            updateCounters(session.id, u.input + u.output, cost);
          }
        },
        cancel() { reader.cancel(); },
      });

      const responseHeaders = new Headers(CORS_HEADERS);
      responseHeaders.set("Content-Type", "text/event-stream");
      responseHeaders.set("Cache-Control", "no-store");
      for (const [k, v] of Object.entries(bvHeaders)) responseHeaders.set(k, v);

      return new Response(wrappedStream, { status: statusCode, headers: responseHeaders });
    }

    // ── Handle non-streaming ─────────────────────────────
    const responseText = await upstreamResponse.text();
    const latencyMs = Date.now() - startTime;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let openaiResponse: any;
    let usage = { input: 0, output: 0 };

    if (statusCode >= 400) {
      // Forward error as-is but wrap in OpenAI error format
      try {
        const errBody = JSON.parse(responseText);
        openaiResponse = {
          error: {
            message: errBody.error?.message ?? errBody.message ?? responseText,
            type: "upstream_error",
            code: statusCode,
            provider: targetProvider,
          },
        };
      } catch {
        openaiResponse = { error: { message: responseText, type: "upstream_error", code: statusCode } };
      }
    } else if (targetProvider === "anthropic") {
      const parsed = JSON.parse(responseText);
      const u = parsed.usage as Record<string, number> | undefined;
      usage = { input: u?.input_tokens ?? 0, output: u?.output_tokens ?? 0 };
      openaiResponse = anthropicToOpenai(parsed, model);
    } else if (targetProvider === "google") {
      const parsed = JSON.parse(responseText);
      const u = parsed.usageMetadata as Record<string, number> | undefined;
      usage = { input: u?.promptTokenCount ?? 0, output: u?.candidatesTokenCount ?? 0 };
      openaiResponse = googleToOpenai(parsed, model);
    } else {
      // OpenAI-compatible — parse usage, forward
      try {
        const parsed = JSON.parse(responseText);
        const u = parsed.usage as Record<string, number> | undefined;
        usage = { input: u?.prompt_tokens ?? 0, output: u?.completion_tokens ?? 0 };
        openaiResponse = parsed;
      } catch {
        openaiResponse = { raw: responseText };
      }
    }

    const cost = estimateCost(targetProvider, model, usage.input, usage.output);
    logRequest(session.id, userId, targetProvider, model, "/v1/chat/completions", statusCode, usage.input, usage.output, latencyMs, request);
    updateCounters(session.id, usage.input + usage.output, cost);

    const responseHeaders = new Headers(CORS_HEADERS);
    responseHeaders.set("Content-Type", "application/json");
    responseHeaders.set("Cache-Control", "no-store");
    for (const [k, v] of Object.entries(bvHeaders)) responseHeaders.set(k, v);

    return new Response(JSON.stringify(openaiResponse), {
      status: statusCode,
      headers: responseHeaders,
    });
  } catch (err) {
    return NextResponse.json(
      { error: { message: "Internal gateway error", type: "server_error", details: err instanceof Error ? err.message : String(err) } },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// ── Fire-and-forget helpers ──────────────────────────────

function logRequest(
  sessionId: string, userId: string, provider: string, model: string,
  endpoint: string, statusCode: number, inputTokens: number, outputTokens: number,
  latencyMs: number, request: Request
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
  const ua = request.headers.get("user-agent") ?? null;
  const cost = estimateCost(provider, model, inputTokens, outputTokens);
  db.insert(proxyLogs).values({
    sessionId, userId, provider, model, endpoint, method: "POST", statusCode,
    inputTokens, outputTokens, totalTokens: inputTokens + outputTokens,
    estimatedCost: cost.toFixed(6), latencyMs, ipAddress: ip, userAgent: ua,
  }).then(() => {}).catch(() => {});
}

function updateCounters(sessionId: string, totalTokens: number, cost: number) {
  db.update(proxySessions).set({
    totalRequests: sql`${proxySessions.totalRequests} + 1`,
    totalTokensUsed: sql`${proxySessions.totalTokensUsed} + ${totalTokens}`,
    totalCost: sql`${proxySessions.totalCost} + ${cost}`,
    updatedAt: new Date(),
  }).where(eq(proxySessions.id, sessionId)).then(() => {}).catch(() => {});
}

export const POST = handleUniversalChat;
export const OPTIONS_HANDLER = OPTIONS;
