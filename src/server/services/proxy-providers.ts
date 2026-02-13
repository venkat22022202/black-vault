export interface ProviderConfig {
  baseUrl: string;
  buildHeaders(realKey: string): Record<string, string>;
  extractModel(body: Record<string, unknown> | null, path: string): string | null;
  parseStreamChunk(line: string, acc: UsageAccumulator): void;
  extractUsage(body: Record<string, unknown>): { input: number; output: number };
  isStreamDone(line: string): boolean;
  /** Headers to strip from client request before forwarding */
  stripHeaders: string[];
}

export interface UsageAccumulator {
  input: number;
  output: number;
}

const openai: ProviderConfig = {
  baseUrl: "https://api.openai.com",
  buildHeaders(realKey) {
    return { Authorization: `Bearer ${realKey}` };
  },
  extractModel(body) {
    return (body?.model as string) ?? null;
  },
  parseStreamChunk(line, acc) {
    if (!line.startsWith("data: ") || line === "data: [DONE]") return;
    try {
      const data = JSON.parse(line.slice(6));
      if (data.usage) {
        acc.input = data.usage.prompt_tokens ?? acc.input;
        acc.output = data.usage.completion_tokens ?? acc.output;
      }
    } catch {
      // skip malformed chunks
    }
  },
  extractUsage(body) {
    const u = body.usage as Record<string, number> | undefined;
    return {
      input: u?.prompt_tokens ?? 0,
      output: u?.completion_tokens ?? 0,
    };
  },
  isStreamDone(line) {
    return line === "data: [DONE]";
  },
  stripHeaders: ["authorization"],
};

const anthropic: ProviderConfig = {
  baseUrl: "https://api.anthropic.com",
  buildHeaders(realKey) {
    return {
      "x-api-key": realKey,
      "anthropic-version": "2023-06-01",
    };
  },
  extractModel(body) {
    return (body?.model as string) ?? null;
  },
  parseStreamChunk(line, acc) {
    if (!line.startsWith("data: ")) return;
    try {
      const data = JSON.parse(line.slice(6));
      if (data.type === "message_start" && data.message?.usage) {
        acc.input = data.message.usage.input_tokens ?? acc.input;
      }
      if (data.type === "message_delta" && data.usage) {
        acc.output = data.usage.output_tokens ?? acc.output;
      }
    } catch {
      // skip malformed chunks
    }
  },
  extractUsage(body) {
    const u = body.usage as Record<string, number> | undefined;
    return {
      input: u?.input_tokens ?? 0,
      output: u?.output_tokens ?? 0,
    };
  },
  isStreamDone(line) {
    if (!line.startsWith("data: ")) return false;
    try {
      const data = JSON.parse(line.slice(6));
      return data.type === "message_stop";
    } catch {
      return false;
    }
  },
  stripHeaders: ["x-api-key", "authorization"],
};

const google: ProviderConfig = {
  baseUrl: "https://generativelanguage.googleapis.com",
  buildHeaders(realKey) {
    return { "x-goog-api-key": realKey };
  },
  extractModel(_body, path) {
    // Path format: v1beta/models/gemini-2.0-flash:generateContent
    const match = path.match(/models\/([^:/?]+)/);
    return match?.[1] ?? null;
  },
  parseStreamChunk(line, acc) {
    if (!line.startsWith("data: ")) return;
    try {
      const data = JSON.parse(line.slice(6));
      if (data.usageMetadata) {
        acc.input = data.usageMetadata.promptTokenCount ?? acc.input;
        acc.output = data.usageMetadata.candidatesTokenCount ?? acc.output;
      }
    } catch {
      // skip malformed chunks
    }
  },
  extractUsage(body) {
    const u = body.usageMetadata as Record<string, number> | undefined;
    return {
      input: u?.promptTokenCount ?? 0,
      output: u?.candidatesTokenCount ?? 0,
    };
  },
  isStreamDone(line) {
    return line.trim() === "";
  },
  stripHeaders: ["x-goog-api-key", "authorization"],
};

export const PROXY_PROVIDERS: Record<string, ProviderConfig> = {
  openai,
  anthropic,
  google,
};
