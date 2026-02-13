// Pricing per 1M tokens: [input, output]
const PRICING: Record<string, [number, number]> = {
  // OpenAI
  "gpt-4o": [2.5, 10.0],
  "gpt-4o-mini": [0.15, 0.6],
  "gpt-4-turbo": [10.0, 30.0],
  "gpt-4": [30.0, 60.0],
  "gpt-3.5-turbo": [0.5, 1.5],
  "o1": [15.0, 60.0],
  "o1-mini": [3.0, 12.0],
  "o3-mini": [1.1, 4.4],
  // Anthropic
  "claude-sonnet-4-5-20250929": [3.0, 15.0],
  "claude-haiku-4-5-20251001": [0.8, 4.0],
  "claude-3-5-sonnet-20241022": [3.0, 15.0],
  "claude-3-haiku-20240307": [0.25, 1.25],
  "claude-3-opus-20240229": [15.0, 75.0],
  // Nebius (OpenAI-compatible, hosts open-source models)
  "deepseek-ai/DeepSeek-R1-0528": [0.5, 2.0],
  "meta-llama/Llama-3.1-70B-Instruct": [0.35, 0.4],
  "meta-llama/Llama-3.1-8B-Instruct": [0.03, 0.06],
  "mistralai/Mixtral-8x22B-Instruct-v0.1": [0.65, 0.65],
  // Google
  "gemini-2.0-flash": [0.075, 0.3],
  "gemini-1.5-pro": [1.25, 5.0],
  "gemini-1.5-flash": [0.075, 0.3],
  "gemini-pro": [0.5, 1.5],
};

const DEFAULT_PRICING: [number, number] = [1.0, 3.0];

export function estimateCost(
  _provider: string,
  model: string | null,
  inputTokens: number,
  outputTokens: number
): number {
  const [inputRate, outputRate] = PRICING[model ?? ""] ?? DEFAULT_PRICING;
  return (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
}
