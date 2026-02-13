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
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
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

const LIMITS = {
  vaultReveal: { requests: 5, window: "1 m" },
  vaultCreate: { requests: 10, window: "1 m" },
  agentSubmit: { requests: 3, window: "1 m" },
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
