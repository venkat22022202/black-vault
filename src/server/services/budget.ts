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
 * `INCRBY`, so concurrent requests see each other immediately. Each request
 * reserves a conservative estimate before forwarding upstream, then reconciles
 * the reservation to the *actual* cost once the response (and its token usage)
 * is known. Overshoot is bounded to a single boundary-crossing request instead
 * of the whole burst — matching the documented "402 when exhausted" behaviour.
 *
 * Money is counted in integer **nano-dollars** (1e-9 USD). Float dollars drift:
 * ten $0.10 requests sum to 0.9999999999999999 in IEEE-754, which is `< 1.00`,
 * so a $1 cap admitted an 11th request. Integers compare exactly, and 2^53
 * nano-dollars (~$9M) is far beyond any session budget.
 *
 * Degrades gracefully: if Redis is not configured or unavailable, it falls back
 * to the durable DB total (or denies, with BLACKVAULT_REDIS_FAIL_MODE=closed).
 */
import { redisFailMode, withRedis, RedisUnavailableError, getRedis } from "./redis-client";

// New prefix: counters under the old `bv:budget:spent:` (float dollars) are
// ignored and expire via their TTL; new counters re-seed from the DB total.
const BUDGET_PREFIX = "bv:budget:nanos:";
// Long TTL so an active counter survives; cleaned up automatically for dead sessions.
const BUDGET_TTL_SECONDS = 60 * 60 * 24 * 35; // 35 days

const NANOS_PER_USD = 1_000_000_000;

export function usdToNanos(usd: number): number {
  return Math.round(usd * NANOS_PER_USD);
}

export function nanosToUsd(nanos: number): number {
  return nanos / NANOS_PER_USD;
}

function budgetKey(sessionId: string): string {
  return `${BUDGET_PREFIX}${sessionId}`;
}

/**
 * Pure decision: is a session at or over its cap?
 * Exported for unit testing the enforcement policy without Redis.
 */
export function isExhausted(spentBefore: number, maxBudget: number | null): boolean {
  if (maxBudget === null) return false;
  return usdToNanos(spentBefore) >= usdToNanos(maxBudget);
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
  /** True when the decision fell back because Redis was unavailable. */
  degraded?: boolean;
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

  const key = budgetKey(sessionId);
  const maxNanos = usdToNanos(maxBudget);
  const reserveNanos = Math.max(0, usdToNanos(estimatedCost));

  try {
    const spentBeforeNanos = await withRedis(async (redis) => {
      // Seed the counter from the durable DB total on a cold cache (no-op if present).
      await redis.set(key, usdToNanos(dbTotalCost), { nx: true, ex: BUDGET_TTL_SECONDS });
      // Atomic reserve. The pre-increment value is the authoritative spend so far.
      const after = Number(await redis.incrby(key, reserveNanos));
      if (!Number.isSafeInteger(after)) throw new Error(`Corrupt budget counter: ${after}`);
      const before = after - reserveNanos;
      if (before >= maxNanos) {
        // Already exhausted — refund the reservation and reject.
        await redis.incrby(key, -reserveNanos);
      }
      return before;
    });

    if (spentBeforeNanos >= maxNanos) {
      return { allowed: false, spentBefore: nanosToUsd(spentBeforeNanos), reserved: 0, remaining: 0 };
    }
    return {
      allowed: true,
      spentBefore: nanosToUsd(spentBeforeNanos),
      reserved: nanosToUsd(reserveNanos),
      remaining: nanosToUsd(maxNanos - spentBeforeNanos),
    };
  } catch (err) {
    // Redis not configured → the DB total is the only source (dev / self-host
    // without Redis). Redis unavailable → same fallback, unless fail-closed.
    const configured = getRedis() !== null;
    const degraded = configured || !(err instanceof RedisUnavailableError);
    const allowed =
      !(degraded && redisFailMode() === "closed") && !isExhausted(dbTotalCost, maxBudget);
    return {
      allowed,
      spentBefore: dbTotalCost,
      reserved: 0,
      remaining: nanosToUsd(Math.max(0, maxNanos - usdToNanos(dbTotalCost))),
      degraded: degraded || undefined,
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
  const deltaNanos = usdToNanos(actualCost) - usdToNanos(reserved);
  if (deltaNanos === 0 || reserved === 0) return;
  try {
    await withRedis((redis) => redis.incrby(budgetKey(sessionId), deltaNanos));
  } catch {
    // Best effort — the durable DB counter still records actual spend.
  }
}

/**
 * The cost to record for a finished request. When an inference request
 * succeeded but its token usage is unknown (stream cut off before the final
 * usage chunk, provider omitted it), charge the conservative pre-request
 * estimate instead of $0 — otherwise disconnecting just before the end of a
 * stream makes any request free. Uses the estimate rather than the reservation
 * so this also holds for unbudgeted sessions and when Redis is down (both
 * reserve $0).
 */
export function settledCost(params: {
  statusCode: number;
  inputTokens: number;
  outputTokens: number;
  computedCost: number;
  estimatedCost: number;
}): number {
  const { statusCode, inputTokens, outputTokens, computedCost, estimatedCost } = params;
  const usageUnknown = inputTokens === 0 && outputTokens === 0;
  if (statusCode < 400 && usageUnknown) return estimatedCost;
  return computedCost;
}

/** Read the current authoritative spend (for headers / display). */
export async function getSpend(sessionId: string, dbTotalCost: number): Promise<number> {
  try {
    const v = await withRedis((redis) => redis.get<string | number>(budgetKey(sessionId)));
    if (v === null || v === undefined) return dbTotalCost;
    return nanosToUsd(Number(v));
  } catch {
    return dbTotalCost;
  }
}

/** Clear a session's spend counter (e.g. on permanent revocation). */
export async function clearBudget(sessionId: string): Promise<void> {
  try {
    await withRedis((redis) => redis.del(budgetKey(sessionId)));
  } catch {
    // Best effort.
  }
}
