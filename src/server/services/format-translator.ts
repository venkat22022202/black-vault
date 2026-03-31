/**
 * Format Translator — converts between OpenAI, Anthropic, and Google API formats.
 * Used by the universal gateway to accept OpenAI-format requests and proxy them
 * to any provider, translating requests and responses automatically.
 */

// ─── Types ───────────────────────────────────────────────

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string | string[];
  [key: string]: unknown;
}

interface OpenAIChoice {
  index: number;
  message: { role: string; content: string };
  finish_reason: string | null;
}

interface OpenAIResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

// ─── OpenAI → Anthropic ─────────────────────────────────

export function openaiToAnthropic(body: OpenAIRequest): {
  url: string;
  body: Record<string, unknown>;
} {
  const systemMessages = body.messages.filter((m) => m.role === "system");
  const nonSystemMessages = body.messages.filter((m) => m.role !== "system");

  const anthropicBody: Record<string, unknown> = {
    model: body.model,
    messages: nonSystemMessages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    max_tokens: body.max_tokens ?? 4096,
  };

  if (systemMessages.length > 0) {
    anthropicBody.system = systemMessages.map((m) => m.content).join("\n\n");
  }

  if (body.temperature !== undefined) anthropicBody.temperature = body.temperature;
  if (body.top_p !== undefined) anthropicBody.top_p = body.top_p;
  if (body.stream) anthropicBody.stream = true;
  if (body.stop) {
    anthropicBody.stop_sequences = Array.isArray(body.stop) ? body.stop : [body.stop];
  }

  return {
    url: "https://api.anthropic.com/v1/messages",
    body: anthropicBody,
  };
}

export function anthropicToOpenai(
  anthropicResponse: Record<string, unknown>,
  model: string
): OpenAIResponse {
  const content = (anthropicResponse.content as Array<{ type: string; text: string }>)
    ?.filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("") ?? "";

  const usage = anthropicResponse.usage as Record<string, number> | undefined;
  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;

  const stopReason = anthropicResponse.stop_reason as string | undefined;
  const finishReason =
    stopReason === "end_turn" ? "stop" :
    stopReason === "max_tokens" ? "length" :
    stopReason === "stop_sequence" ? "stop" :
    "stop";

  return {
    id: `chatcmpl-${(anthropicResponse.id as string) ?? crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: { role: "assistant", content },
      finish_reason: finishReason,
    }],
    usage: {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    },
  };
}

// ─── OpenAI → Google ────────────────────────────────────

export function openaiToGoogle(body: OpenAIRequest): {
  url: string;
  body: Record<string, unknown>;
} {
  const systemMessages = body.messages.filter((m) => m.role === "system");
  const nonSystemMessages = body.messages.filter((m) => m.role !== "system");

  const googleBody: Record<string, unknown> = {
    contents: nonSystemMessages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
  };

  if (systemMessages.length > 0) {
    googleBody.systemInstruction = {
      parts: [{ text: systemMessages.map((m) => m.content).join("\n\n") }],
    };
  }

  const generationConfig: Record<string, unknown> = {};
  if (body.max_tokens !== undefined) generationConfig.maxOutputTokens = body.max_tokens;
  if (body.temperature !== undefined) generationConfig.temperature = body.temperature;
  if (body.top_p !== undefined) generationConfig.topP = body.top_p;
  if (body.stop) {
    generationConfig.stopSequences = Array.isArray(body.stop) ? body.stop : [body.stop];
  }
  if (Object.keys(generationConfig).length > 0) {
    googleBody.generationConfig = generationConfig;
  }

  const method = body.stream ? "streamGenerateContent?alt=sse" : "generateContent";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${body.model}:${method}`;

  return { url, body: googleBody };
}

export function googleToOpenai(
  googleResponse: Record<string, unknown>,
  model: string
): OpenAIResponse {
  const candidates = googleResponse.candidates as Array<{
    content: { parts: Array<{ text: string }>; role: string };
    finishReason?: string;
  }> | undefined;

  const content = candidates?.[0]?.content?.parts
    ?.map((p) => p.text)
    .join("") ?? "";

  const finishReason =
    candidates?.[0]?.finishReason === "MAX_TOKENS" ? "length" : "stop";

  const usage = googleResponse.usageMetadata as Record<string, number> | undefined;
  const inputTokens = usage?.promptTokenCount ?? 0;
  const outputTokens = usage?.candidatesTokenCount ?? 0;

  return {
    id: `chatcmpl-${crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: { role: "assistant", content },
      finish_reason: finishReason,
    }],
    usage: {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    },
  };
}

// ─── Streaming Translators ──────────────────────────────

/**
 * Transform an Anthropic SSE stream into OpenAI-compatible SSE chunks.
 */
export function createAnthropicToOpenaiStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  model: string
): { stream: ReadableStream; getUsage: () => { input: number; output: number } } {
  const decoder = new TextDecoder();
  let buffer = "";
  let msgId = `chatcmpl-${crypto.randomUUID()}`;
  let sentRole = false;
  const usage = { input: 0, output: 0 };

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let data: Record<string, unknown>;
          try { data = JSON.parse(raw); } catch { continue; }

          const type = data.type as string;

          if (type === "message_start") {
            const msg = data.message as Record<string, unknown> | undefined;
            const u = msg?.usage as Record<string, number> | undefined;
            if (u?.input_tokens) usage.input = u.input_tokens;
            msgId = `chatcmpl-${(msg?.id as string) ?? crypto.randomUUID()}`;

            // Send role chunk
            if (!sentRole) {
              sentRole = true;
              controller.enqueue(new TextEncoder().encode(
                `data: ${JSON.stringify({
                  id: msgId, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model,
                  choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }],
                })}\n\n`
              ));
            }
          }

          if (type === "content_block_delta") {
            const delta = data.delta as Record<string, string> | undefined;
            const text = delta?.text ?? "";
            if (text) {
              controller.enqueue(new TextEncoder().encode(
                `data: ${JSON.stringify({
                  id: msgId, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model,
                  choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
                })}\n\n`
              ));
            }
          }

          if (type === "message_delta") {
            const u = data.usage as Record<string, number> | undefined;
            if (u?.output_tokens) usage.output = u.output_tokens;
            const delta = data.delta as Record<string, string> | undefined;
            const stopReason = delta?.stop_reason;
            const fr = stopReason === "end_turn" ? "stop" : stopReason === "max_tokens" ? "length" : "stop";
            controller.enqueue(new TextEncoder().encode(
              `data: ${JSON.stringify({
                id: msgId, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model,
                choices: [{ index: 0, delta: {}, finish_reason: fr }],
                usage: { prompt_tokens: usage.input, completion_tokens: usage.output, total_tokens: usage.input + usage.output },
              })}\n\n`
            ));
          }

          if (type === "message_stop") {
            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }
        }
      } catch {
        controller.close();
      }
    },
    cancel() { reader.cancel(); },
  });

  return { stream, getUsage: () => usage };
}

/**
 * Transform a Google SSE stream into OpenAI-compatible SSE chunks.
 */
export function createGoogleToOpenaiStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  model: string
): { stream: ReadableStream; getUsage: () => { input: number; output: number } } {
  const decoder = new TextDecoder();
  let buffer = "";
  const msgId = `chatcmpl-${crypto.randomUUID()}`;
  let sentRole = false;
  const usage = { input: 0, output: 0 };

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let data: Record<string, unknown>;
          try { data = JSON.parse(raw); } catch { continue; }

          const candidates = data.candidates as Array<{
            content: { parts: Array<{ text: string }> };
            finishReason?: string;
          }> | undefined;

          const text = candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          const finishReason = candidates?.[0]?.finishReason;

          const u = data.usageMetadata as Record<string, number> | undefined;
          if (u?.promptTokenCount) usage.input = u.promptTokenCount;
          if (u?.candidatesTokenCount) usage.output = u.candidatesTokenCount;

          if (!sentRole) {
            sentRole = true;
            controller.enqueue(new TextEncoder().encode(
              `data: ${JSON.stringify({
                id: msgId, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model,
                choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }],
              })}\n\n`
            ));
          }

          if (text) {
            controller.enqueue(new TextEncoder().encode(
              `data: ${JSON.stringify({
                id: msgId, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model,
                choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
              })}\n\n`
            ));
          }

          if (finishReason === "STOP" || finishReason === "MAX_TOKENS") {
            const fr = finishReason === "MAX_TOKENS" ? "length" : "stop";
            controller.enqueue(new TextEncoder().encode(
              `data: ${JSON.stringify({
                id: msgId, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model,
                choices: [{ index: 0, delta: {}, finish_reason: fr }],
                usage: { prompt_tokens: usage.input, completion_tokens: usage.output, total_tokens: usage.input + usage.output },
              })}\n\n`
            ));
          }
        }
      } catch {
        controller.close();
      }
    },
    cancel() { reader.cancel(); },
  });

  return { stream, getUsage: () => usage };
}
