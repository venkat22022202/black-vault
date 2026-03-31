import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { TRPCError } from "@trpc/server";

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  _redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL.trim(),
    token: process.env.UPSTASH_REDIS_REST_TOKEN.trim(),
  });
  return _redis;
}

const limiters: Record<string, Ratelimit | null> = {};

function getLimiter(key: string, requests: number, window: string): Ratelimit | null {
  if (limiters[key] !== undefined) return limiters[key];
  const redis = getRedis();
  if (!redis) {
    limiters[key] = null;
    return null;
  }
  limiters[key] = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window as `${number} ${"s" | "m" | "h" | "d"}`),
    prefix: `bv:rl:${key}`,
  });
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
    limiter: Ratelimit.slidingWindow(requests, window as `${number} ${"s" | "m" | "h" | "d"}`),
    prefix,
  });
}

const LIMITS = {
  vaultReveal: { requests: 5, window: "1 m" },
  vaultCreate: { requests: 10, window: "1 m" },
  agentSubmit: { requests: 3, window: "1 m" },
  proxyRequest: { requests: 200, window: "1 m" },
} as const;

export async function checkRateLimit(
  limiterKey: keyof typeof LIMITS,
  userId: string
): Promise<void> {
  const config = LIMITS[limiterKey];
  const limiter = getLimiter(limiterKey, config.requests, config.window);
  if (!limiter) return; // Skip if Redis not configured

  const result = await limiter.limit(userId);
  if (!result.success) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded. Try again in ${Math.ceil(result.reset - Date.now() / 1000)}s.`,
    });
  }
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch ms
  retryAfter?: number; // seconds
}

/**
 * Global proxy rate limit check (200 req/min per user).
 */
export async function checkProxyRateLimit(
  userId: string
): Promise<RateLimitResult> {
  const config = LIMITS.proxyRequest;
  const limiter = getLimiter("proxyRequest", config.requests, config.window);
  if (!limiter) return { allowed: true, limit: config.requests, remaining: config.requests, reset: Date.now() + 60000 };

  const result = await limiter.limit(userId);
  if (!result.success) {
    return {
      allowed: false,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
    };
  }
  return {
    allowed: true,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
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
  if (!limiter) return { allowed: true, limit: rpm, remaining: rpm, reset: Date.now() + 60000 };

  const result = await limiter.limit(sessionId);
  if (!result.success) {
    return {
      allowed: false,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
    };
  }
  return {
    allowed: true,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/**
 * Per-session rate limit: requests per day.
 */
export async function checkSessionRpdLimit(
  sessionId: string,
  rpd: number
): Promise<RateLimitResult> {
  const limiter = createDynamicLimiter(`bv:sess:rpd:${rpd}`, rpd, "1 d");
  if (!limiter) return { allowed: true, limit: rpd, remaining: rpd, reset: Date.now() + 86400000 };

  const result = await limiter.limit(sessionId);
  if (!result.success) {
    return {
      allowed: false,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
    };
  }
  return {
    allowed: true,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}
