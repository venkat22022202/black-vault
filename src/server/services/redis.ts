import { getRedis, recordRedisFailure, recordRedisSuccess, withRedis } from "./redis-client";

/**
 * Cache helper — falls back to the direct fetcher when Redis is not configured
 * or unavailable (see redis-client.ts for the timeout + circuit breaker).
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    const hit = await withRedis((redis) => redis.get<T>(key));
    if (hit !== null && hit !== undefined) return hit;
  } catch {
    // Redis down or not configured — fall through to fetcher
  }

  const data = await fetcher();

  try {
    await withRedis((redis) => redis.set(key, JSON.stringify(data), { ex: ttlSeconds }));
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
 * Invalidate a cache key.
 *
 * Deliberately bypasses the circuit breaker: this is how a kill switch evicts a
 * cached proxy session, and skipping it because the circuit opened on an
 * earlier blip would let a revoked token keep working for the cache TTL (60s).
 * Still bounded by the client's per-request timeout.
 */
export async function invalidateCache(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(key);
    recordRedisSuccess();
  } catch {
    recordRedisFailure();
  }
}
