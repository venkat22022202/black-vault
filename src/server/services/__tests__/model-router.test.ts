import { describe, it, expect } from "vitest";
import { routeModel } from "../model-router";

describe("routeModel", () => {
  it("routes OpenAI model prefixes", () => {
    expect(routeModel("gpt-4o")?.provider).toBe("openai");
    expect(routeModel("o3-mini")?.provider).toBe("openai");
  });

  it("routes Anthropic models", () => {
    expect(routeModel("claude-sonnet-4-5-20250929")?.provider).toBe("anthropic");
  });

  it("routes Google models", () => {
    expect(routeModel("gemini-2.0-flash")?.provider).toBe("google");
  });

  it("routes Nebius open-source models", () => {
    expect(routeModel("meta-llama/Llama-3.1-70B-Instruct")?.provider).toBe("nebius");
    expect(routeModel("deepseek-r1")?.provider).toBe("nebius");
  });

  it("returns null for unroutable models", () => {
    expect(routeModel("totally-unknown-model")).toBeNull();
  });
});
