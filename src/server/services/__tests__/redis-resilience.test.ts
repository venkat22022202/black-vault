import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  withRedis,
  isRedisDegraded,
  RedisUnavailableError,
  __resetRedisClientForTests,
} from "../redis-client";
import { invalidateCache } from "../redis";
import { reserveBudget } from "../budget";
import { checkProxyRateLimit, secondsUntil } from "../ratelimit";

// Point at a port nothing listens on: any real network call fails fast, and the
// breaker tests drive failures through `fn` without touching the network.
beforeEach(() => {
  process.env.UPSTASH_REDIS_REST_URL = "http://127.0.0.1:9";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test";
  delete process.env.BLACKVAULT_REDIS_FAIL_MODE;
  __resetRedisClientForTests();
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.BLACKVAULT_REDIS_FAIL_MODE;
  __resetRedisClientForTests();
});

describe("withRedis circuit breaker", () => {
  it("opens after a failure and skips Redis until the cooldown passes", async () => {
    vi.useFakeTimers();
    await expect(withRedis(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(isRedisDegraded()).toBe(true);

    // While open, fn is never invoked — no per-request timeout cost.
    const fn = vi.fn(() => Promise.resolve("never"));
    await expect(withRedis(fn)).rejects.toBeInstanceOf(RedisUnavailableError);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(30_001);
    expect(isRedisDegraded()).toBe(false);
    await expect(withRedis(() => Promise.resolve("ok"))).resolves.toBe("ok");
  });

  it("is never degraded when Redis is not configured", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    __resetRedisClientForTests();
    await expect(withRedis(() => Promise.resolve(1))).rejects.toBeInstanceOf(RedisUnavailableError);
    expect(isRedisDegraded()).toBe(false);
  });
});

describe("degraded mode decisions", () => {
  async function tripBreaker() {
    await withRedis(() => Promise.reject(new Error("down"))).catch(() => {});
  }

  it("fail-open (default): rate limit allows but flags degraded", async () => {
    await tripBreaker();
    const r = await checkProxyRateLimit("user-1");
    expect(r.allowed).toBe(true);
    expect(r.degraded).toBe(true);
  });

  it("fail-closed: rate limit denies with a retry hint", async () => {
    process.env.BLACKVAULT_REDIS_FAIL_MODE = "closed";
    await tripBreaker();
    const r = await checkProxyRateLimit("user-1");
    expect(r.allowed).toBe(false);
    expect(r.degraded).toBe(true);
    expect(r.retryAfter).toBeGreaterThan(0);
  });

  it("fail-open budget falls back to the durable DB total", async () => {
    await tripBreaker();
    const under = await reserveBudget("s1", 5, 4.99, 0.01);
    expect(under).toMatchObject({ allowed: true, degraded: true, reserved: 0 });
    const over = await reserveBudget("s1", 5, 5, 0.01);
    expect(over.allowed).toBe(false);
  });

  it("fail-closed budget denies budgeted sessions it cannot meter", async () => {
    process.env.BLACKVAULT_REDIS_FAIL_MODE = "closed";
    await tripBreaker();
    const r = await reserveBudget("s1", 5, 0, 0.01);
    expect(r.allowed).toBe(false);
    // Unbudgeted sessions are unaffected.
    expect((await reserveBudget("s1", null, 0, 0.01)).allowed).toBe(true);
  });
});

describe("kill switch cache eviction", () => {
  it("still attempts the DEL while the circuit is open", async () => {
    // A revoked token must not survive in cache just because an earlier blip
    // opened the circuit on this instance.
    await withRedis(() => Promise.reject(new Error("blip"))).catch(() => {});
    expect(isRedisDegraded()).toBe(true);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      // The client auto-pipelines, so commands go out as a batch.
      .mockResolvedValue(new Response(JSON.stringify([{ result: 1 }])));
    await invalidateCache("proxy:session:abc");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][1]?.body)).toBe(JSON.stringify([["del", "proxy:session:abc"]]));
    expect(isRedisDegraded()).toBe(false); // success closes the circuit
    fetchSpy.mockRestore();
  });
});

describe("secondsUntil", () => {
  it("converts an epoch-ms reset into whole seconds from now", () => {
    // Regression: `Math.ceil(reset - Date.now() / 1000)` reported ~1.7e12 s.
    const now = 1_759_000_000_000;
    expect(secondsUntil(now + 12_300, now)).toBe(13);
    expect(secondsUntil(now - 5_000, now)).toBe(0);
  });
});
