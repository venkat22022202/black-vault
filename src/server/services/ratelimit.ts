import { Ratelimit } from "@upstash/ratelimit";
import { TRPCError } from "@trpc/server";
import { getRedis, redisFailMode, withRedis } from "./redis-client";

type Window = `${number} ${"s" | "m" | "h" | "d"}`;

const limiters: Record<string, Ratelimit | null> = {};

function getLimiter(key: string, requests: number, window: string): Ratelimit | null {
  if (limiters[key] !== undefined) return limiters[key];
  const redis = getRedis();
  limiters[key] = redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(requests, window as Window),
        prefix: `bv:rl:${key}`,
      })
    : null;
  return limiters[key];
}

/**
 * Create a dynamic limiter (not cached in the limiters map) for per-session limits.
 */
function createDynamicLimiter(prefix: string, requests: number, window: string): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window as Window),
    prefix,
  });
}

const LIMITS = {
  vaultReveal: { requests: 5, window: "1 m" },
  vaultCreate: { requests: 10, window: "1 m" },
  agentSubmit: { requests: 3, window: "1 m" },
  proxyRequest: { requests: 200, window: "1 m" },
} as const;

/** How long a caller is told to back off when limits can't be evaluated (fail-closed). */
const UNAVAILABLE_RETRY_AFTER_SECONDS = 30;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch ms
  retryAfter?: number; // seconds
  /** True when the limit could not be evaluated because Redis is unavailable. */
  degraded?: boolean;
}

/** Seconds until `resetMs` (epoch ms), never negative. */
export function secondsUntil(resetMs: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((resetMs - now) / 1000));
}

/**
 * Evaluate a limiter. Redis not configured → allow (local/dev mode). Redis
 * configured but failing → allow or deny per BLACKVAULT_REDIS_FAIL_MODE, and
 * flag the result as degraded so routes can surface it.
 */
async function evaluate(
  limiter: Ratelimit | null,
  identifier: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (!limiter) return { allowed: true, limit, remaining: limit, reset: Date.now() + windowMs };

  let result;
  try {
    result = await withRedis(() => limiter.limit(identifier));
  } catch {
    const allowed = redisFailMode() === "open";
    return {
      allowed,
      limit,
      remaining: allowed ? limit : 0,
      reset: Date.now() + windowMs,
      retryAfter: allowed ? undefined : UNAVAILABLE_RETRY_AFTER_SECONDS,
      degraded: true,
    };
  }

  if (!result.success) {
    return {
      allowed: false,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      retryAfter: secondsUntil(result.reset),
    };
  }
  return {
    allowed: true,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

export async function checkRateLimit(
  limiterKey: keyof typeof LIMITS,
  userId: string
): Promise<void> {
  const config = LIMITS[limiterKey];
  const limiter = getLimiter(limiterKey, config.requests, config.window);
  const result = await evaluate(limiter, userId, config.requests, 60_000);
  if (!result.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: result.degraded
        ? "Rate limiting is temporarily unavailable. Try again shortly."
        : `Rate limit exceeded. Try again in ${secondsUntil(result.reset)}s.`,
    });
  }
}

/**
 * Global proxy rate limit check (200 req/min per user).
 */
export async function checkProxyRateLimit(
  userId: string
): Promise<RateLimitResult> {
  const config = LIMITS.proxyRequest;
  const limiter = getLimiter("proxyRequest", config.requests, config.window);
  return evaluate(limiter, userId, config.requests, 60_000);
}

/**
 * Per-session rate limit: requests per minute.
 * Uses a dynamic limiter keyed by session ID.
 */
export async function checkSessionRpmLimit(
  sessionId: string,
  rpm: number
): Promise<RateLimitResult> {
  const limiter = createDynamicLimiter(`bv:sess:rpm:${rpm}`, rpm, "1 m");
  return evaluate(limiter, sessionId, rpm, 60_000);
}

/**
 * Per-session rate limit: requests per day.
 */
export async function checkSessionRpdLimit(
  sessionId: string,
  rpd: number
): Promise<RateLimitResult> {
  const limiter = createDynamicLimiter(`bv:sess:rpd:${rpd}`, rpd, "1 d");
  return evaluate(limiter, sessionId, rpd, 86_400_000);
}
