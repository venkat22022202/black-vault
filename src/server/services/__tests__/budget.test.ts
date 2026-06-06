import { describe, it, expect, beforeAll } from "vitest";
import { isExhausted, reserveBudget } from "../budget";

// Ensure Redis is treated as unconfigured so we exercise the deterministic
// fallback path (no network calls in unit tests).
beforeAll(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe("isExhausted", () => {
  it("is never exhausted when no budget is configured", () => {
    expect(isExhausted(9999, null)).toBe(false);
  });
  it("is exhausted at or over the cap", () => {
    expect(isExhausted(5, 5)).toBe(true);
    expect(isExhausted(5.01, 5)).toBe(true);
  });
  it("is not exhausted below the cap", () => {
    expect(isExhausted(4.99, 5)).toBe(false);
  });
});

describe("reserveBudget (no Redis fallback)", () => {
  it("always allows when no budget is set", async () => {
    const r = await reserveBudget("s1", null, 0, 1);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBeNull();
  });

  it("allows when spend is below the cap", async () => {
    const r = await reserveBudget("s1", 5, 2, 0.01);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBeCloseTo(3, 6);
  });

  it("rejects when DB total is already at the cap", async () => {
    const r = await reserveBudget("s1", 5, 5, 0.01);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });
});
