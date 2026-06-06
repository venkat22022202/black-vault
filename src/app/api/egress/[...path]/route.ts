import { NextRequest, NextResponse } from "next/server";
import { authenticateProxyRequest, ProxyAuthError } from "@/server/services/proxy-auth";
import { db } from "@/server/db";
import { vaultKeys, proxyLogs, proxySessions } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { decryptApiKey } from "@/server/services/encryption";
import { evaluateEgress } from "@/server/services/egress-policy";
import { parseHttpTarget, buildUpstreamUrl, applyTargetAuth } from "@/server/services/egress-target";
import {
  checkProxyRateLimit,
  checkSessionRpmLimit,
  checkSessionRpdLimit,
} from "@/server/services/ratelimit";

/**
 * Egress firewall — give an AI agent a real credential it can never steal and
 * can't misuse. The agent calls this endpoint with a `bvt_` token bound to an
 * HTTP target (a vaulted secret + pinned host + policy). BlackVault evaluates
 * the policy, injects the real secret toward the PINNED host only, forwards the
 * request, and audits every attempt. The agent never sees the secret.
 *
 * See docs/design/0003-egress-firewall.md.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

const REQUEST_TIMEOUT = 5 * 60 * 1000;
const FORWARDED_HEADERS = ["content-type", "accept", "user-agent"];

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function handleEgress(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const startTime = Date.now();
    const { path: pathSegments } = await params;
    const path = "/" + (pathSegments ?? []).join("/");

    // ── Authenticate (bvt_ → kill switch / expiry / IP / budget) ──
    let auth;
    try {
      auth = await authenticateProxyRequest(request);
    } catch (err) {
      if (err instanceof ProxyAuthError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode, headers: CORS_HEADERS });
      }
      return NextResponse.json({ error: "Authentication failed" }, { status: 500, headers: CORS_HEADERS });
    }

    const { session, vaultKey, userId, limits } = auth;
    const method = request.method;

    // ── Resolve the HTTP target from the vault key's metadata ──
    const [row] = await db
      .select({ metadata: vaultKeys.metadata })
      .from(vaultKeys)
      .where(eq(vaultKeys.id, vaultKey.id))
      .limit(1);

    const target = parseHttpTarget(row?.metadata);
    if (!target) {
      return NextResponse.json(
        { error: "This token is not bound to an HTTP egress target. Configure one in your vault." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // ── Rate limiting (reuse the proxy limiters) ──
    const globalRate = await checkProxyRateLimit(userId);
    if (!globalRate.allowed) {
      return NextResponse.json(
        { error: "Global rate limit exceeded", retryAfter: globalRate.retryAfter },
        { status: 429, headers: { ...CORS_HEADERS, "Retry-After": String(globalRate.retryAfter) } }
      );
    }
    if (limits.rateLimitRpm !== null) {
      const rpm = await checkSessionRpmLimit(session.id, limits.rateLimitRpm);
      if (!rpm.allowed) {
        return NextResponse.json(
          { error: "Session rate limit exceeded (RPM)", retryAfter: rpm.retryAfter },
          { status: 429, headers: { ...CORS_HEADERS, "Retry-After": String(rpm.retryAfter) } }
        );
      }
    }
    if (limits.rateLimitRpd !== null) {
      const rpd = await checkSessionRpdLimit(session.id, limits.rateLimitRpd);
      if (!rpd.allowed) {
        return NextResponse.json(
          { error: "Session daily limit exceeded (RPD)", retryAfter: rpd.retryAfter },
          { status: 429, headers: { ...CORS_HEADERS, "Retry-After": String(rpd.retryAfter) } }
        );
      }
    }

    // ── Policy gate (the firewall) ──
    const decision = evaluateEgress({ method, path, policy: target.policy });
    if (!decision.allowed) {
      const latencyMs = Date.now() - startTime;
      logEgress(session.id, userId, target.baseUrl, path, method, 403, latencyMs, request);
      return NextResponse.json(
        {
          error: "Blocked by egress policy",
          reason: decision.reason,
          detail: decision.message,
        },
        {
          status: 403,
          headers: { ...CORS_HEADERS, "X-BlackVault-Egress": "blocked", "X-BlackVault-Egress-Reason": decision.reason ?? "denied" },
        }
      );
    }

    // ── Build the upstream URL (host PINNED to the target origin) ──
    const url = buildUpstreamUrl(target, path, request.nextUrl.search);
    if (!url) {
      const latencyMs = Date.now() - startTime;
      logEgress(session.id, userId, target.baseUrl, path, method, 403, latencyMs, request);
      return NextResponse.json(
        { error: "Blocked by egress policy", reason: "invalid_path", detail: "Path is invalid or would leave the pinned host" },
        { status: 403, headers: { ...CORS_HEADERS, "X-BlackVault-Egress": "blocked" } }
      );
    }

    // ── Decrypt + inject the real credential ──
    let secret: string;
    try {
      secret = decryptApiKey(vaultKey.encryptedKey, vaultKey.iv, userId, vaultKey.id);
    } catch {
      return NextResponse.json({ error: "Failed to decrypt credential" }, { status: 500, headers: CORS_HEADERS });
    }

    const headers = new Headers();
    for (const name of FORWARDED_HEADERS) {
      const v = request.headers.get(name);
      if (v) headers.set(name, v);
    }
    // Never forward the bvt_ token upstream; inject the real secret toward the pinned host only.
    applyTargetAuth(target, url, headers, secret);

    let body: string | null = null;
    if (method !== "GET" && method !== "HEAD") {
      body = await request.text();
    }

    // ── Forward ──
    let upstream: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      upstream = await fetch(url.toString(), { method, headers, body, signal: controller.signal });
      clearTimeout(timeout);
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      logEgress(session.id, userId, target.baseUrl, path, method, 502, latencyMs, request);
      return NextResponse.json(
        { error: "Failed to reach target", details: err instanceof Error ? err.message : "Unknown error" },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    const respBody = await upstream.text();
    const latencyMs = Date.now() - startTime;
    logEgress(session.id, userId, target.baseUrl, path, method, upstream.status, latencyMs, request);
    bumpRequestCount(session.id);

    return new Response(respBody, {
      status: upstream.status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
        "X-BlackVault-Egress": "allowed",
        "X-BlackVault-Session": session.id,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal egress error", details: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// Fire-and-forget audit (allowed AND blocked attempts both land here).
function logEgress(
  sessionId: string,
  userId: string,
  baseUrl: string,
  path: string,
  method: string,
  statusCode: number,
  latencyMs: number,
  request: Request
) {
  let host = "egress";
  try {
    host = new URL(baseUrl).host;
  } catch {
    /* keep default */
  }
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;
  db.insert(proxyLogs)
    .values({
      sessionId,
      userId,
      provider: host,
      model: null,
      endpoint: path,
      method,
      statusCode,
      latencyMs,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") ?? null,
    })
    .then(() => {})
    .catch(() => {});
}

function bumpRequestCount(sessionId: string) {
  db.update(proxySessions)
    .set({ totalRequests: sql`${proxySessions.totalRequests} + 1`, updatedAt: new Date() })
    .where(eq(proxySessions.id, sessionId))
    .then(() => {})
    .catch(() => {});
}

export const GET = handleEgress;
export const POST = handleEgress;
export const PUT = handleEgress;
export const DELETE = handleEgress;
export const PATCH = handleEgress;
export const HEAD = handleEgress;
