/**
 * Format Translator — converts between OpenAI, Anthropic, and Google API formats.
 * Used by the universal gateway to accept OpenAI-format requests and proxy them
 * to any provider, translating requests and responses automatically.
 *
 * Supports text, multimodal (image) content, and function/tool calling — the
 * features agent frameworks (LangChain, CrewAI, AutoGen, …) actually depend on.
 */

// ─── Types ───────────────────────────────────────────────

export type OpenAIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: string } };

export interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | OpenAIContentPart[] | null;
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export type OpenAIToolChoice =
  | "auto"
  | "none"
  | "required"
  | { type: "function"; function: { name: string } };

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string | string[];
  tools?: OpenAITool[];
  tool_choice?: OpenAIToolChoice;
  [key: string]: unknown;
}

interface OpenAIChoice {
  index: number;
  message: { role: string; content: string | null; tool_calls?: OpenAIToolCall[] };
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

// ─── Shared helpers ─────────────────────────────────────

/** Parse an OpenAI image_url (data URL or remote URL). */
function parseImageUrl(
  url: string
): { kind: "base64"; mediaType: string; data: string } | { kind: "url"; url: string } {
  // [\s\S] instead of the `s` flag so this compiles under an ES2017 target.
  const m = url.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (m) return { kind: "base64", mediaType: m[1], data: m[2] };
  return { kind: "url", url };
}

/** Flatten OpenAI message content (string | parts | null) to plain text. */
function contentToText(content: OpenAIMessage["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("");
  }
  return "";
}

function safeJsonParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ─── OpenAI → Anthropic ─────────────────────────────────

type AnthropicBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: Record<string, unknown> }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

function openaiContentToAnthropicBlocks(content: OpenAIMessage["content"]): AnthropicBlock[] {
  if (typeof content === "string") {
    return content ? [{ type: "text", text: content }] : [];
  }
  if (Array.isArray(content)) {
    const blocks: AnthropicBlock[] = [];
    for (const part of content) {
      if (part.type === "text") {
        if (part.text) blocks.push({ type: "text", text: part.text });
      } else if (part.type === "image_url") {
        const img = parseImageUrl(part.image_url.url);
        if (img.kind === "base64") {
          blocks.push({
            type: "image",
            source: { type: "base64", media_type: img.mediaType, data: img.data },
          });
        } else {
          blocks.push({ type: "image", source: { type: "url", url: img.url } });
        }
      }
    }
    return blocks;
  }
  return [];
}

export function openaiToAnthropic(body: OpenAIRequest): {
  url: string;
  body: Record<string, unknown>;
} {
  const systemMessages = body.messages.filter((m) => m.role === "system");

  // Build Anthropic messages, merging consecutive same-role runs (Anthropic
  // requires alternating user/assistant turns).
  const messages: { role: "user" | "assistant"; content: AnthropicBlock[] }[] = [];
  const push = (role: "user" | "assistant", blocks: AnthropicBlock[]) => {
    if (blocks.length === 0) return;
    const last = messages[messages.length - 1];
    if (last && last.role === role) {
      last.content.push(...blocks);
    } else {
      messages.push({ role, content: blocks });
    }
  };

  for (const m of body.messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      // Tool results map to a user turn with tool_result blocks.
      push("user", [
        {
          type: "tool_result",
          tool_use_id: m.tool_call_id ?? "",
          content: contentToText(m.content),
        },
      ]);
      continue;
    }
    if (m.role === "assistant") {
      const blocks = openaiContentToAnthropicBlocks(m.content);
      if (m.tool_calls?.length) {
        for (const tc of m.tool_calls) {
          blocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: safeJsonParse(tc.function.arguments),
          });
        }
      }
      push("assistant", blocks);
      continue;
    }
    // user
    push("user", openaiContentToAnthropicBlocks(m.content));
  }

  const anthropicBody: Record<string, unknown> = {
    model: body.model,
    messages,
    max_tokens: body.max_tokens ?? 4096,
  };

  if (systemMessages.length > 0) {
    anthropicBody.system = systemMessages.map((m) => contentToText(m.content)).join("\n\n");
  }

  if (body.temperature !== undefined) anthropicBody.temperature = body.temperature;
  if (body.top_p !== undefined) anthropicBody.top_p = body.top_p;
  if (body.stream) anthropicBody.stream = true;
  if (body.stop) {
    anthropicBody.stop_sequences = Array.isArray(body.stop) ? body.stop : [body.stop];
  }

  // Tools
  if (body.tools?.length) {
    anthropicBody.tools = body.tools.map((t) => ({
      name: t.function.name,
      description: t.function.description ?? "",
      input_schema: t.function.parameters ?? { type: "object", properties: {} },
    }));
  }

  // Tool choice
  if (body.tool_choice !== undefined) {
    const tc = body.tool_choice;
    if (tc === "auto") anthropicBody.tool_choice = { type: "auto" };
    else if (tc === "required") anthropicBody.tool_choice = { type: "any" };
    else if (tc === "none") anthropicBody.tool_choice = { type: "none" };
    else if (typeof tc === "object" && tc.type === "function") {
      anthropicBody.tool_choice = { type: "tool", name: tc.function.name };
    }
  }

  return { url: "https://api.anthropic.com/v1/messages", body: anthropicBody };
}

export function anthropicToOpenai(
  anthropicResponse: Record<string, unknown>,
  model: string
): OpenAIResponse {
  const blocks =
    (anthropicResponse.content as Array<{
      type: string;
      text?: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    }>) ?? [];

  const text = blocks
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  const toolCalls: OpenAIToolCall[] = blocks
    .filter((b) => b.type === "tool_use")
    .map((b) => ({
      id: b.id ?? `call_${crypto.randomUUID()}`,
      type: "function" as const,
      function: { name: b.name ?? "", arguments: JSON.stringify(b.input ?? {}) },
    }));

  const usage = anthropicResponse.usage as Record<string, number> | undefined;
  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;

  const stopReason = anthropicResponse.stop_reason as string | undefined;
  const finishReason =
    stopReason === "tool_use" ? "tool_calls" :
    stopReason === "max_tokens" ? "length" :
    "stop";

  return {
    id: `chatcmpl-${(anthropicResponse.id as string) ?? crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: text.length ? text : toolCalls.length ? null : "",
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      },
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

type GooglePart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { mimeType: string; fileUri: string } }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

function openaiContentToGoogleParts(content: OpenAIMessage["content"]): GooglePart[] {
  if (typeof content === "string") {
    return content ? [{ text: content }] : [];
  }
  if (Array.isArray(content)) {
    const parts: GooglePart[] = [];
    for (const part of content) {
      if (part.type === "text") {
        if (part.text) parts.push({ text: part.text });
      } else if (part.type === "image_url") {
        const img = parseImageUrl(part.image_url.url);
        if (img.kind === "base64") {
          parts.push({ inlineData: { mimeType: img.mediaType, data: img.data } });
        } else {
          parts.push({ fileData: { mimeType: "image/*", fileUri: img.url } });
        }
      }
    }
    return parts;
  }
  return [];
}

export function openaiToGoogle(body: OpenAIRequest): {
  url: string;
  body: Record<string, unknown>;
} {
  const systemMessages = body.messages.filter((m) => m.role === "system");

  // Map tool_call_id → function name so tool results can carry their name.
  const toolNameById = new Map<string, string>();
  for (const m of body.messages) {
    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) toolNameById.set(tc.id, tc.function.name);
    }
  }

  const contents: { role: "user" | "model"; parts: GooglePart[] }[] = [];
  const push = (role: "user" | "model", parts: GooglePart[]) => {
    if (parts.length === 0) return;
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts.push(...parts);
    } else {
      contents.push({ role, parts });
    }
  };

  for (const m of body.messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      const name = m.tool_call_id ? toolNameById.get(m.tool_call_id) ?? m.tool_call_id : "";
      push("user", [
        {
          functionResponse: {
            name,
            response: { content: contentToText(m.content) },
          },
        },
      ]);
      continue;
    }
    if (m.role === "assistant") {
      const parts = openaiContentToGoogleParts(m.content);
      if (m.tool_calls?.length) {
        for (const tc of m.tool_calls) {
          parts.push({
            functionCall: { name: tc.function.name, args: safeJsonParse(tc.function.arguments) },
          });
        }
      }
      push("model", parts);
      continue;
    }
    push("user", openaiContentToGoogleParts(m.content));
  }

  const googleBody: Record<string, unknown> = { contents };

  if (systemMessages.length > 0) {
    googleBody.systemInstruction = {
      parts: [{ text: systemMessages.map((m) => contentToText(m.content)).join("\n\n") }],
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

  // Tools
  if (body.tools?.length) {
    googleBody.tools = [
      {
        functionDeclarations: body.tools.map((t) => ({
          name: t.function.name,
          description: t.function.description ?? "",
          parameters: t.function.parameters ?? { type: "object", properties: {} },
        })),
      },
    ];
  }

  // Tool choice
  if (body.tool_choice !== undefined) {
    const tc = body.tool_choice;
    let mode: string | null = null;
    let allowedFunctionNames: string[] | undefined;
    if (tc === "auto") mode = "AUTO";
    else if (tc === "required") mode = "ANY";
    else if (tc === "none") mode = "NONE";
    else if (typeof tc === "object" && tc.type === "function") {
      mode = "ANY";
      allowedFunctionNames = [tc.function.name];
    }
    if (mode) {
      googleBody.toolConfig = {
        functionCallingConfig: {
          mode,
          ...(allowedFunctionNames ? { allowedFunctionNames } : {}),
        },
      };
    }
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
    content?: { parts?: Array<{ text?: string; functionCall?: { name: string; args?: Record<string, unknown> } }>; role?: string };
    finishReason?: string;
  }> | undefined;

  const parts = candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("");

  const toolCalls: OpenAIToolCall[] = parts
    .filter((p) => p.functionCall)
    .map((p, i) => ({
      id: `call_${i}_${p.functionCall!.name}`,
      type: "function" as const,
      function: { name: p.functionCall!.name, arguments: JSON.stringify(p.functionCall!.args ?? {}) },
    }));

  const rawFinish = candidates?.[0]?.finishReason;
  const finishReason =
    toolCalls.length ? "tool_calls" :
    rawFinish === "MAX_TOKENS" ? "length" :
    "stop";

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
      message: {
        role: "assistant",
        content: text.length ? text : toolCalls.length ? null : "",
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      },
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

const enc = new TextEncoder();
function sse(obj: unknown): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

/**
 * Transform an Anthropic SSE stream into OpenAI-compatible SSE chunks.
 * Handles text deltas and streamed tool calls (tool_use → tool_calls deltas).
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

  // Track which content-block index is a tool_use and its OpenAI tool index.
  const toolIndexForBlock = new Map<number, number>();
  let toolCounter = 0;

  const baseChunk = (choices: unknown[]) => ({
    id: msgId,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices,
  });

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
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
            if (!sentRole) {
              sentRole = true;
              controller.enqueue(sse(baseChunk([
                { index: 0, delta: { role: "assistant", content: "" }, finish_reason: null },
              ])));
            }
          }

          if (type === "content_block_start") {
            const idx = data.index as number;
            const block = data.content_block as Record<string, unknown> | undefined;
            if (block?.type === "tool_use") {
              const toolIndex = toolCounter++;
              toolIndexForBlock.set(idx, toolIndex);
              // Emit the opening tool_call chunk (id + name, empty arguments).
              controller.enqueue(sse(baseChunk([
                {
                  index: 0,
                  delta: {
                    tool_calls: [{
                      index: toolIndex,
                      id: (block.id as string) ?? `call_${crypto.randomUUID()}`,
                      type: "function",
                      function: { name: (block.name as string) ?? "", arguments: "" },
                    }],
                  },
                  finish_reason: null,
                },
              ])));
            }
          }

          if (type === "content_block_delta") {
            const idx = data.index as number;
            const delta = data.delta as Record<string, string> | undefined;
            if (delta?.type === "text_delta" && delta.text) {
              controller.enqueue(sse(baseChunk([
                { index: 0, delta: { content: delta.text }, finish_reason: null },
              ])));
            } else if (delta?.type === "input_json_delta") {
              const toolIndex = toolIndexForBlock.get(idx);
              if (toolIndex !== undefined) {
                controller.enqueue(sse(baseChunk([
                  {
                    index: 0,
                    delta: { tool_calls: [{ index: toolIndex, function: { arguments: delta.partial_json ?? "" } }] },
                    finish_reason: null,
                  },
                ])));
              }
            }
          }

          if (type === "message_delta") {
            const u = data.usage as Record<string, number> | undefined;
            if (u?.output_tokens) usage.output = u.output_tokens;
            const delta = data.delta as Record<string, string> | undefined;
            const stopReason = delta?.stop_reason;
            const fr =
              stopReason === "tool_use" ? "tool_calls" :
              stopReason === "max_tokens" ? "length" :
              "stop";
            controller.enqueue(sse({
              ...baseChunk([{ index: 0, delta: {}, finish_reason: fr }]),
              usage: { prompt_tokens: usage.input, completion_tokens: usage.output, total_tokens: usage.input + usage.output },
            }));
          }

          if (type === "message_stop") {
            controller.enqueue(enc.encode("data: [DONE]\n\n"));
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
 * Handles text deltas and function calls (functionCall → tool_calls deltas).
 */
export function createGoogleToOpenaiStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  model: string
): { stream: ReadableStream; getUsage: () => { input: number; output: number } } {
  const decoder = new TextDecoder();
  let buffer = "";
  const msgId = `chatcmpl-${crypto.randomUUID()}`;
  let sentRole = false;
  let toolCounter = 0;
  const usage = { input: 0, output: 0 };

  const baseChunk = (choices: unknown[]) => ({
    id: msgId,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices,
  });

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
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
            content?: { parts?: Array<{ text?: string; functionCall?: { name: string; args?: Record<string, unknown> } }> };
            finishReason?: string;
          }> | undefined;

          const parts = candidates?.[0]?.content?.parts ?? [];
          const finishReason = candidates?.[0]?.finishReason;

          const u = data.usageMetadata as Record<string, number> | undefined;
          if (u?.promptTokenCount) usage.input = u.promptTokenCount;
          if (u?.candidatesTokenCount) usage.output = u.candidatesTokenCount;

          if (!sentRole) {
            sentRole = true;
            controller.enqueue(sse(baseChunk([
              { index: 0, delta: { role: "assistant", content: "" }, finish_reason: null },
            ])));
          }

          let sawToolCall = false;
          for (const part of parts) {
            if (part.text) {
              controller.enqueue(sse(baseChunk([
                { index: 0, delta: { content: part.text }, finish_reason: null },
              ])));
            } else if (part.functionCall) {
              sawToolCall = true;
              const toolIndex = toolCounter++;
              controller.enqueue(sse(baseChunk([
                {
                  index: 0,
                  delta: {
                    tool_calls: [{
                      index: toolIndex,
                      id: `call_${toolIndex}_${part.functionCall.name}`,
                      type: "function",
                      function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args ?? {}) },
                    }],
                  },
                  finish_reason: null,
                },
              ])));
            }
          }

          if (finishReason === "STOP" || finishReason === "MAX_TOKENS" || sawToolCall) {
            const fr = sawToolCall ? "tool_calls" : finishReason === "MAX_TOKENS" ? "length" : "stop";
            controller.enqueue(sse({
              ...baseChunk([{ index: 0, delta: {}, finish_reason: fr }]),
              usage: { prompt_tokens: usage.input, completion_tokens: usage.output, total_tokens: usage.input + usage.output },
            }));
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
