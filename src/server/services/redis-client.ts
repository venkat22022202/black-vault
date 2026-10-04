/**
 * Shared Upstash Redis client — bounded latency + circuit breaker.
 *
 * Why this exists: the default Upstash client retries a failed request 5 times
 * with `exp(i) * 50ms` backoff, i.e. ~4.3s of sleeping per command. When the
 * Redis database became unreachable, every proxy request paid that twice (cache
 * GET + SET) and took ~9.6s just to reject a bad token — while rate limits and
 * real-time budgets silently degraded and nothing reported it.
 *
 * Here every command is capped by a per-attempt timeout with a single retry, and
 * after a failure the circuit opens: Redis is skipped entirely for a cooldown
 * window, so a dead Redis costs one slow request per window instead of every
 * request. `/api/health` reports the state so the degradation is visible.
 *
 * NOTE: the timeout must be passed as a signal *function*. With a plain
 * AbortSignal the Upstash client does not throw on abort — it fabricates a
 * successful response whose result is the string "Aborted", which would flow
 * into budget math as NaN (and NaN >= cap is false → request allowed).
 */
import { Redis } from "@upstash/redis";

const TIMEOUT_MS = Number(process.env.REDIS_TIMEOUT_MS) || 800;
const COOLDOWN_MS = 30_000;

let client: Redis | null | undefined;
let circuitOpenUntil = 0;
let lastFailureAt: number | null = null;

export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  client =
    url && token
      ? new Redis({
          url,
          token,
          retry: { retries: 1, backoff: () => 50 },
          signal: () => AbortSignal.timeout(TIMEOUT_MS),
        })
      : null;
  return client;
}

/** Whether to deny (closed) or allow (open) rate-limited traffic while Redis is down. */
export type RedisFailMode = "open" | "closed";

export function redisFailMode(): RedisFailMode {
  return process.env.BLACKVAULT_REDIS_FAIL_MODE === "closed" ? "closed" : "open";
}

/** Redis is configured but currently treated as down. */
export function isRedisDegraded(now = Date.now()): boolean {
  return getRedis() !== null && now < circuitOpenUntil;
}

export function recordRedisFailure(now = Date.now()): void {
  lastFailureAt = now;
  circuitOpenUntil = now + COOLDOWN_MS;
}

export function recordRedisSuccess(): void {
  circuitOpenUntil = 0;
}

export class RedisUnavailableError extends Error {
  constructor() {
    super("Redis unavailable");
  }
}

/**
 * Run `fn` against Redis. Throws {@link RedisUnavailableError} when Redis is not
 * configured or the circuit is open; a failure inside `fn` opens the circuit and
 * is rethrown. Callers keep their own fallback in a catch.
 */
export async function withRedis<T>(fn: (redis: Redis) => Promise<T>): Promise<T> {
  const redis = getRedis();
  if (!redis || isRedisDegraded()) throw new RedisUnavailableError();
  try {
    const result = await fn(redis);
    recordRedisSuccess();
    return result;
  } catch (err) {
    recordRedisFailure();
    throw err;
  }
}

/** Active probe for health checks — bypasses the open circuit and updates it. */
export async function probeRedis(): Promise<
  | { status: "not_configured" }
  | { status: "ok" | "down"; latencyMs: number; lastFailureAt: string | null }
> {
  const redis = getRedis();
  if (!redis) return { status: "not_configured" };
  const start = Date.now();
  let status: "ok" | "down" = "ok";
  try {
    await redis.ping();
    recordRedisSuccess();
  } catch {
    recordRedisFailure();
    status = "down";
  }
  return {
    status,
    latencyMs: Date.now() - start,
    lastFailureAt: lastFailureAt ? new Date(lastFailureAt).toISOString() : null,
  };
}

/** Test hook: reset module state between tests. */
export function __resetRedisClientForTests(): void {
  client = undefined;
  circuitOpenUntil = 0;
  lastFailureAt = null;
}
