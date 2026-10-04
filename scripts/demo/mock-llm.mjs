#!/usr/bin/env node
/**
 * Mock OpenAI-compatible upstream for the demo / end-to-end tests.
 *
 * - Only accepts the *real* vaulted key (MOCK_REAL_KEY): proves BlackVault
 *   injects it and the agent never needs it.
 * - Reports token usage like OpenAI, so cost/budget math is exercised.
 * - Streams with the final usage chunk deliberately split across two network
 *   writes, which an unbuffered SSE parser silently drops (→ billed $0).
 *
 *   MOCK_PORT=8090 MOCK_REAL_KEY=sk-real node scripts/demo/mock-llm.mjs
 */
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 8090);
const REAL_KEY = process.env.MOCK_REAL_KEY ?? "sk-demo-real-key";
const OUTPUT_TOKENS = 50;

let seenRequests = 0;

http
  .createServer(async (req, res) => {
    if (req.headers.authorization !== `Bearer ${REAL_KEY}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Incorrect API key provided" } }));
      return;
    }
    seenRequests++;
    if (req.method === "GET" && req.url === "/__stats") {
      res.end(JSON.stringify({ seenRequests }));
      return;
    }
    if (req.method === "GET" && req.url.startsWith("/v1/models")) {
      res.end(JSON.stringify({ object: "list", data: [{ id: "gpt-4o-mini", object: "model" }] }));
      return;
    }
    if (req.method !== "POST" || !req.url.startsWith("/v1/chat/completions")) {
      res.writeHead(404).end();
      return;
    }

    let raw = "";
    for await (const c of req) raw += c;
    const body = JSON.parse(raw);
    const prompt = Math.ceil(JSON.stringify(body.messages ?? []).length / 4);
    const completion = Math.min(OUTPUT_TOKENS, body.max_tokens ?? OUTPUT_TOKENS);
    const usage = { prompt_tokens: prompt, completion_tokens: completion, total_tokens: prompt + completion };
    const id = `chatcmpl-mock-${seenRequests}`;
    const text = "Hello from the mock upstream. Your real key stayed in the vault.";

    if (!body.stream) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id,
          object: "chat.completion",
          model: body.model,
          choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
          usage,
        })
      );
      return;
    }

    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const word of text.split(" ")) {
      res.write(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", model: body.model, choices: [{ index: 0, delta: { content: word + " " } }] })}\n\n`);
      await sleep(5);
    }
    const usageLine = `data: ${JSON.stringify({ id, object: "chat.completion.chunk", model: body.model, choices: [], usage })}\n\n`;
    const cut = Math.floor(usageLine.length / 2);
    res.write(usageLine.slice(0, cut));
    await sleep(50); // force the two halves into separate network chunks
    res.write(usageLine.slice(cut));
    res.end("data: [DONE]\n\n");
  })
  .listen(PORT, "127.0.0.1", () => console.log(`mock-llm listening on http://127.0.0.1:${PORT}`));
