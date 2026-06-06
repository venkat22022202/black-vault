/**
 * Budget enforcement — real-time, atomic, concurrency-safe.
 *
 * The previous implementation checked spend against a 60s-cached session row and
 * incremented the spend counter fire-and-forget *after* the response. Under a
 * burst of concurrent requests, every request read the same stale total, so the
 * cap ("$5 budget so an agent can't burn $500 overnight") could be blown past
 * by an unbounded amount.
 *
 * This service makes the spend counter authoritative in Redis via an atomic
 * `INCRBYFLOAT`, so concurrent requests see each other immediately. Each request
 * reserves a conservative estimate before forwarding upstream, then reconciles
 * the reservation to the *actual* cost once the response (and its token usage)
 * is known. Overshoot is bounded to a single boundary-crossing request instead
 * of the whole burst — matching the documented "402 when exhausted" behaviour.
 *
 * Degrades gracefully: if Redis is not configured or errors, it falls back to
 * the (best-effort) DB total rather than blocking all traffic.
 */
import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

const BUDGET_PREFIX = "bv:budget:spent:";
// Long TTL so an active counter survives; cleaned up automatically for dead sessions.
const BUDGET_TTL_SECONDS = 60 * 60 * 24 * 35; // 35 days

function budgetKey(sessionId: string): string {
  return `${BUDGET_PREFIX}${sessionId}`;
}

/**
 * Pure decision: is a session at or over its cap?
 * Exported for unit testing the enforcement policy without Redis.
 */
export function isExhausted(spentBefore: number, maxBudget: number | null): boolean {
  if (maxBudget === null) return false;
  return spentBefore >= maxBudget;
}

export interface ReservationResult {
  /** Whether the request is allowed to proceed. */
  allowed: boolean;
  /** Authoritative spend before this request's reservation. */
  spentBefore: number;
  /** Amount reserved for this request (0 if rejected or no budget configured). */
  reserved: number;
  /** Remaining budget, or null if no budget is configured. */
  remaining: number | null;
}

/**
 * Atomically reserve budget for an in-flight request.
 *
 * Policy: a NEW request is rejected only once authoritative spend has reached the
 * cap. The reservation makes concurrent in-flight requests visible to each other,
 * and is reconciled to the actual cost in {@link commitSpend}.
 */
export async function reserveBudget(
  sessionId: string,
  maxBudget: number | null,
  dbTotalCost: number,
  estimatedCost: number
): Promise<ReservationResult> {
  if (maxBudget === null) {
    return { allowed: true, spentBefore: dbTotalCost, reserved: 0, remaining: null };
  }

  const redis = getRedis();
  if (!redis) {
    // No Redis — best-effort check against the DB total.
    const allowed = !isExhausted(dbTotalCost, maxBudget);
    return {
      allowed,
      spentBefore: dbTotalCost,
      reserved: 0,
      remaining: Math.max(0, maxBudget - dbTotalCost),
    };
  }

  const key = budgetKey(sessionId);
  const reserve = Math.max(0, estimatedCost);

  try {
    // Seed the counter from the durable DB total on a cold cache (no-op if present).
    await redis.set(key, dbTotalCost, { nx: true, ex: BUDGET_TTL_SECONDS });

    // Atomic reserve. The pre-increment value is the authoritative spend so far.
    const after = Number(await redis.incrbyfloat(key, reserve));
    const spentBefore = after - reserve;

    if (isExhausted(spentBefore, maxBudget)) {
      // Already exhausted — refund the reservation and reject.
      await redis.incrbyfloat(key, -reserve);
      return { allowed: false, spentBefore, reserved: 0, remaining: 0 };
    }

    return {
      allowed: true,
      spentBefore,
      reserved: reserve,
      remaining: Math.max(0, maxBudget - spentBefore),
    };
  } catch {
    // Redis error — degrade to the DB check rather than blocking all traffic.
    const allowed = !isExhausted(dbTotalCost, maxBudget);
    return {
      allowed,
      spentBefore: dbTotalCost,
      reserved: 0,
      remaining: Math.max(0, maxBudget - dbTotalCost),
    };
  }
}

/**
 * Reconcile a reservation to the actual cost once a request completes.
 * Pass `actualCost = 0` when the request failed to fully refund the reservation.
 */
export async function commitSpend(
  sessionId: string,
  reserved: number,
  actualCost: number
): Promise<void> {
  const delta = actualCost - reserved;
  if (delta === 0) return;
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.incrbyfloat(budgetKey(sessionId), delta);
  } catch {
    // Best effort — the durable DB counter still records actual spend.
  }
}

/** Read the current authoritative spend (for headers / display). */
export async function getSpend(sessionId: string, dbTotalCost: number): Promise<number> {
  const redis = getRedis();
  if (!redis) return dbTotalCost;
  try {
    const v = await redis.get<string | number>(budgetKey(sessionId));
    if (v === null || v === undefined) return dbTotalCost;
    return Number(v);
  } catch {
    return dbTotalCost;
  }
}

/** Clear a session's spend counter (e.g. on permanent revocation). */
export async function clearBudget(sessionId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(budgetKey(sessionId));
  } catch {
    // Best effort.
  }
}
