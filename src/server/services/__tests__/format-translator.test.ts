import { describe, it, expect } from "vitest";
import {
  openaiToAnthropic,
  anthropicToOpenai,
  openaiToGoogle,
  googleToOpenai,
} from "../format-translator";

describe("openaiToAnthropic", () => {
  it("splits system messages into the system field", () => {
    const { body } = openaiToAnthropic({
      model: "claude-sonnet-4-5",
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "hi" },
      ],
    });
    expect(body.system).toBe("You are helpful.");
    expect((body.messages as unknown[]).length).toBe(1);
  });

  it("translates tools to Anthropic input_schema", () => {
    const { body } = openaiToAnthropic({
      model: "claude-sonnet-4-5",
      messages: [{ role: "user", content: "weather?" }],
      tools: [
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "Get weather",
            parameters: { type: "object", properties: { city: { type: "string" } } },
          },
        },
      ],
      tool_choice: "required",
    });
    const tools = body.tools as Array<Record<string, unknown>>;
    expect(tools[0].name).toBe("get_weather");
    expect(tools[0].input_schema).toEqual({
      type: "object",
      properties: { city: { type: "string" } },
    });
    expect(body.tool_choice).toEqual({ type: "any" });
  });

  it("translates an assistant tool_call + tool result into tool_use / tool_result blocks", () => {
    const { body } = openaiToAnthropic({
      model: "claude-sonnet-4-5",
      messages: [
        { role: "user", content: "weather in NYC?" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            { id: "call_1", type: "function", function: { name: "get_weather", arguments: '{"city":"NYC"}' } },
          ],
        },
        { role: "tool", tool_call_id: "call_1", content: "72F sunny" },
      ],
    });
    const messages = body.messages as Array<{ role: string; content: Array<Record<string, unknown>> }>;
    // user, assistant(tool_use), user(tool_result)
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(messages[1].content[0]).toMatchObject({
      type: "tool_use",
      id: "call_1",
      name: "get_weather",
      input: { city: "NYC" },
    });
    expect(messages[2].content[0]).toMatchObject({
      type: "tool_result",
      tool_use_id: "call_1",
      content: "72F sunny",
    });
  });

  it("translates multimodal image_url content (base64) to an image block", () => {
    const { body } = openaiToAnthropic({
      model: "claude-sonnet-4-5",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "what is this?" },
            { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
          ],
        },
      ],
    });
    const messages = body.messages as Array<{ content: Array<Record<string, unknown>> }>;
    expect(messages[0].content[1]).toMatchObject({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "AAAA" },
    });
  });
});

describe("anthropicToOpenai", () => {
  it("maps text content and usage", () => {
    const out = anthropicToOpenai(
      {
        id: "msg_1",
        content: [{ type: "text", text: "hello" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 5, output_tokens: 3 },
      },
      "claude-sonnet-4-5"
    );
    expect(out.choices[0].message.content).toBe("hello");
    expect(out.choices[0].finish_reason).toBe("stop");
    expect(out.usage).toEqual({ prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 });
  });

  it("maps tool_use blocks to tool_calls with finish_reason tool_calls", () => {
    const out = anthropicToOpenai(
      {
        id: "msg_2",
        content: [
          { type: "tool_use", id: "toolu_1", name: "get_weather", input: { city: "NYC" } },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 10, output_tokens: 8 },
      },
      "claude-sonnet-4-5"
    );
    expect(out.choices[0].message.content).toBeNull();
    expect(out.choices[0].message.tool_calls?.[0]).toMatchObject({
      id: "toolu_1",
      type: "function",
      function: { name: "get_weather", arguments: '{"city":"NYC"}' },
    });
    expect(out.choices[0].finish_reason).toBe("tool_calls");
  });
});

describe("openaiToGoogle", () => {
  it("maps roles and system instruction", () => {
    const { body, url } = openaiToGoogle({
      model: "gemini-2.0-flash",
      messages: [
        { role: "system", content: "be terse" },
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ],
    });
    expect(url).toContain("gemini-2.0-flash:generateContent");
    expect(body.systemInstruction).toEqual({ parts: [{ text: "be terse" }] });
    const contents = body.contents as Array<{ role: string }>;
    expect(contents.map((c) => c.role)).toEqual(["user", "model"]);
  });

  it("translates tools to functionDeclarations and tool_choice to toolConfig", () => {
    const { body } = openaiToGoogle({
      model: "gemini-2.0-flash",
      messages: [{ role: "user", content: "weather?" }],
      tools: [
        { type: "function", function: { name: "get_weather", parameters: { type: "object" } } },
      ],
      tool_choice: "auto",
    });
    const tools = body.tools as Array<{ functionDeclarations: Array<{ name: string }> }>;
    expect(tools[0].functionDeclarations[0].name).toBe("get_weather");
    expect(body.toolConfig).toMatchObject({ functionCallingConfig: { mode: "AUTO" } });
  });

  it("maps assistant tool_calls and tool results to functionCall / functionResponse", () => {
    const { body } = openaiToGoogle({
      model: "gemini-2.0-flash",
      messages: [
        { role: "user", content: "weather?" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            { id: "call_1", type: "function", function: { name: "get_weather", arguments: '{"city":"NYC"}' } },
          ],
        },
        { role: "tool", tool_call_id: "call_1", content: "72F" },
      ],
    });
    const contents = body.contents as Array<{ role: string; parts: Array<Record<string, unknown>> }>;
    expect(contents[1].parts[0]).toMatchObject({
      functionCall: { name: "get_weather", args: { city: "NYC" } },
    });
    expect(contents[2].parts[0]).toMatchObject({
      functionResponse: { name: "get_weather" },
    });
  });
});

describe("googleToOpenai", () => {
  it("maps text parts and finish reason", () => {
    const out = googleToOpenai(
      {
        candidates: [{ content: { parts: [{ text: "hi there" }] }, finishReason: "STOP" }],
        usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2 },
      },
      "gemini-2.0-flash"
    );
    expect(out.choices[0].message.content).toBe("hi there");
    expect(out.choices[0].finish_reason).toBe("stop");
    expect(out.usage.total_tokens).toBe(6);
  });

  it("maps functionCall parts to tool_calls", () => {
    const out = googleToOpenai(
      {
        candidates: [
          {
            content: { parts: [{ functionCall: { name: "get_weather", args: { city: "NYC" } } }] },
            finishReason: "STOP",
          },
        ],
      },
      "gemini-2.0-flash"
    );
    expect(out.choices[0].message.tool_calls?.[0]).toMatchObject({
      type: "function",
      function: { name: "get_weather", arguments: '{"city":"NYC"}' },
    });
    expect(out.choices[0].finish_reason).toBe("tool_calls");
  });
});
