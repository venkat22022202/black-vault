import { describe, it, expect, beforeAll } from "vitest";
import { isExhausted, reserveBudget, usdToNanos, nanosToUsd, settledCost } from "../budget";

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

describe("money math (integer nano-dollars)", () => {
  it("does not let float drift admit an extra request at the cap", () => {
    let spent = 0;
    for (let i = 0; i < 10; i++) spent += 0.1; // 0.9999999999999999 in IEEE-754
    expect(spent < 1).toBe(true);
    expect(isExhausted(spent, 1)).toBe(true);
  });

  it("round-trips sub-cent costs exactly", () => {
    expect(usdToNanos(0.000045)).toBe(45_000);
    expect(nanosToUsd(usdToNanos(0.000045) * 1000)).toBe(0.045);
  });
});

describe("settledCost", () => {
  const base = { computedCost: 0, estimatedCost: 0.02 };
  it("charges actual cost when usage is known", () => {
    expect(settledCost({ ...base, statusCode: 200, inputTokens: 10, outputTokens: 5, computedCost: 0.001 })).toBe(0.001);
  });
  it("charges the estimate when a successful request has unknown usage", () => {
    // e.g. the client disconnected before the stream's final usage chunk
    expect(settledCost({ ...base, statusCode: 200, inputTokens: 0, outputTokens: 0 })).toBe(0.02);
  });
  it("refunds failed requests", () => {
    expect(settledCost({ ...base, statusCode: 500, inputTokens: 0, outputTokens: 0 })).toBe(0);
  });
});
