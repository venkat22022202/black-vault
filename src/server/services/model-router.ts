/**
 * Model Router — maps any model name to its provider.
 * Used by the universal gateway (/api/v1/chat/completions) to auto-route
 * requests to the correct upstream provider.
 */

export type RoutableProvider = "openai" | "anthropic" | "google" | "nebius";

interface ModelRoute {
  provider: RoutableProvider;
  /** If the model needs a different name upstream (e.g., alias), set it here */
  upstreamModel?: string;
}

/**
 * Prefix-based routing rules (checked in order, first match wins).
 */
const PREFIX_RULES: { prefix: string; provider: RoutableProvider }[] = [
  // OpenAI
  { prefix: "gpt-", provider: "openai" },
  { prefix: "o1", provider: "openai" },
  { prefix: "o3", provider: "openai" },
  { prefix: "o4", provider: "openai" },
  { prefix: "chatgpt-", provider: "openai" },
  { prefix: "dall-e", provider: "openai" },
  { prefix: "tts-", provider: "openai" },
  { prefix: "whisper", provider: "openai" },
  // Anthropic
  { prefix: "claude-", provider: "anthropic" },
  // Google
  { prefix: "gemini-", provider: "google" },
  { prefix: "gemma-", provider: "google" },
  // Nebius (open-source models)
  { prefix: "deepseek-ai/", provider: "nebius" },
  { prefix: "meta-llama/", provider: "nebius" },
  { prefix: "mistralai/", provider: "nebius" },
  { prefix: "Qwen/", provider: "nebius" },
];

/**
 * Exact model name overrides (highest priority).
 */
const EXACT_ROUTES: Record<string, RoutableProvider> = {
  "deepseek-r1": "nebius",
  "deepseek-v3": "nebius",
  "llama-3.3-70b": "nebius",
};

/**
 * Route a model name to its provider.
 * Returns null if the model can't be routed.
 */
export function routeModel(model: string): ModelRoute | null {
  // 1. Exact match
  const exact = EXACT_ROUTES[model];
  if (exact) return { provider: exact };

  // 2. Prefix match
  const lower = model.toLowerCase();
  for (const rule of PREFIX_RULES) {
    if (lower.startsWith(rule.prefix.toLowerCase())) {
      return { provider: rule.provider };
    }
  }

  return null;
}

/**
 * Get all routable model prefixes (for documentation / error messages).
 */
export function getSupportedPrefixes(): string[] {
  return PREFIX_RULES.map((r) => `${r.prefix}* → ${r.provider}`);
}
