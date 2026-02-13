import { Redis } from "@upstash/redis";

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

/**
 * Cache helper — falls back to direct fetcher if Redis not configured
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const redis = getRedis();
  if (!redis) return fetcher();

  try {
    const hit = await redis.get<T>(key);
    if (hit !== null && hit !== undefined) return hit;
  } catch {
    // Redis down — fall through to fetcher
  }

  const data = await fetcher();

  try {
    await redis.set(key, JSON.stringify(data), { ex: ttlSeconds });
  } catch {
    // Best-effort cache write
  }

  return data;
}

/**
 * Invalidate the public stats cache (user/key/agent/workflow counts)
 */
export async function invalidatePublicStats(): Promise<void> {
  return invalidateCache("stats:public");
}

/**
 * Invalidate a cache key
 */
export async function invalidateCache(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    // Best-effort
  }
}
