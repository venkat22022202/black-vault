import { describe, it, expect } from "vitest";
import {
  estimateCost,
  estimateTokensFromText,
  extractMaxOutputTokens,
  estimateRequestCost,
} from "../proxy-pricing";

describe("estimateCost", () => {
  it("prices a known model from the table", () => {
    // gpt-4o: [2.5, 10.0] per 1M tokens
    const cost = estimateCost("openai", "gpt-4o", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(12.5, 6);
  });

  it("falls back to default pricing for unknown models", () => {
    // default [1.0, 3.0]
    const cost = estimateCost("openai", "some-unknown-model", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(4.0, 6);
  });

  it("returns 0 for zero tokens", () => {
    expect(estimateCost("openai", "gpt-4o", 0, 0)).toBe(0);
  });
});

describe("estimateTokensFromText", () => {
  it("estimates ~4 chars per token", () => {
    expect(estimateTokensFromText("12345678")).toBe(2);
    expect(estimateTokensFromText("")).toBe(0);
  });
});

describe("extractMaxOutputTokens", () => {
  it("reads max_tokens", () => {
    expect(extractMaxOutputTokens({ max_tokens: 256 })).toBe(256);
  });
  it("reads max_completion_tokens", () => {
    expect(extractMaxOutputTokens({ max_completion_tokens: 512 })).toBe(512);
  });
  it("reads google generationConfig.maxOutputTokens", () => {
    expect(extractMaxOutputTokens({ generationConfig: { maxOutputTokens: 1024 } })).toBe(1024);
  });
  it("returns null when absent", () => {
    expect(extractMaxOutputTokens({})).toBeNull();
    expect(extractMaxOutputTokens(null)).toBeNull();
  });
});

describe("estimateRequestCost", () => {
  it("uses the request's max output cap", () => {
    const cost = estimateRequestCost("openai", "gpt-4o", "x".repeat(400), 1000);
    // input ~100 tokens * 2.5 + 1000 * 10 per 1M
    const expected = (100 * 2.5 + 1000 * 10.0) / 1_000_000;
    expect(cost).toBeCloseTo(expected, 9);
  });

  it("falls back to a conservative default output when no cap is given", () => {
    const cost = estimateRequestCost("openai", "gpt-4o", "", null);
    // 0 input + 4096 default output * 10 per 1M
    expect(cost).toBeCloseTo((4096 * 10.0) / 1_000_000, 9);
  });
});
