#!/usr/bin/env node
/**
 * Minimal Upstash-REST → Redis bridge for local development and the demo.
 *
 * The app talks to Redis through @upstash/redis (HTTP). This shim speaks that
 * protocol (POST / with a JSON command array, /pipeline, /multi-exec; string
 * results base64-encoded when `Upstash-Encoding: base64`) and forwards each
 * command to a real Redis over RESP. No dependencies.
 *
 * Chaos switches, to show how BlackVault behaves when Redis dies:
 *   POST /__chaos/ok         normal operation
 *   POST /__chaos/refuse     drop every request (connection reset) — like a deleted DB
 *   POST /__chaos/blackhole  accept requests and never answer — like a network partition
 *
 *   SHIM_PORT=8079 REDIS_PORT=6379 SHIM_TOKEN=dev node scripts/demo/upstash-shim.mjs
 */
import http from "node:http";
import net from "node:net";

const PORT = Number(process.env.SHIM_PORT ?? 8079);
const REDIS_HOST = process.env.REDIS_HOST ?? "127.0.0.1";
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 6379);
const TOKEN = process.env.SHIM_TOKEN ?? "dev";

let chaos = "ok";

// ── Tiny RESP client: one connection, FIFO reply queue ──────────────────────
class Resp {
  constructor() {
    this.queue = [];
    this.buf = Buffer.alloc(0);
    this.sock = net.connect(REDIS_PORT, REDIS_HOST);
    this.sock.on("data", (d) => {
      this.buf = Buffer.concat([this.buf, d]);
      for (;;) {
        const parsed = parse(this.buf, 0);
        if (!parsed) break;
        this.buf = this.buf.subarray(parsed.end);
        this.queue.shift()?.(parsed.value);
      }
    });
    this.sock.on("error", (e) => {
      for (const cb of this.queue.splice(0)) cb(new RespError(`connection: ${e.message}`));
    });
  }
  send(args) {
    let out = `*${args.length}\r\n`;
    for (const a of args) {
      const s = typeof a === "string" ? a : JSON.stringify(a);
      out += `$${Buffer.byteLength(s)}\r\n${s}\r\n`;
    }
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.sock.write(out);
    });
  }
}

class RespError {
  constructor(message) {
    this.message = message;
  }
}

function parse(buf, i) {
  const nl = buf.indexOf("\r\n", i);
  if (nl === -1) return null;
  const type = String.fromCharCode(buf[i]);
  const line = buf.toString("utf8", i + 1, nl);
  const next = nl + 2;
  switch (type) {
    case "+": return { value: line, end: next };
    case "-": return { value: new RespError(line), end: next };
    case ":": return { value: Number(line), end: next };
    case "$": {
      const len = Number(line);
      if (len === -1) return { value: null, end: next };
      if (buf.length < next + len + 2) return null;
      return { value: buf.toString("utf8", next, next + len), end: next + len + 2 };
    }
    case "*": {
      const n = Number(line);
      if (n === -1) return { value: null, end: next };
      const arr = [];
      let pos = next;
      for (let k = 0; k < n; k++) {
        const el = parse(buf, pos);
        if (!el) return null;
        arr.push(el.value);
        pos = el.end;
      }
      return { value: arr, end: pos };
    }
    default:
      throw new Error(`Unexpected RESP type ${type}`);
  }
}

const redis = new Resp();

function encode(v, b64) {
  if (!b64 || v === null || typeof v === "number") return v;
  if (Array.isArray(v)) return v.map((x) => encode(x, b64));
  if (v === "OK") return v;
  return Buffer.from(String(v), "utf8").toString("base64");
}

async function run(cmd, b64) {
  const reply = await redis.send(cmd);
  if (reply instanceof RespError) return { error: reply.message };
  return { result: encode(reply, b64) };
}

// ── HTTP front ───────────────────────────────────────────────────────────────
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname.startsWith("/__chaos/")) {
      chaos = url.pathname.slice("/__chaos/".length);
      res.end(JSON.stringify({ chaos }));
      return;
    }
    if (chaos === "refuse") return req.socket.destroy();
    if (chaos === "blackhole") return; // never respond

    if (req.headers.authorization !== `Bearer ${TOKEN}`) {
      res.writeHead(401).end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    const b64 = req.headers["upstash-encoding"] === "base64";
    let payload;
    try {
      payload = JSON.parse(body || "[]");
    } catch {
      res.writeHead(400).end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    const path = url.pathname.replace(/^\/+/, "");
    let out;
    let status = 200;
    if (path === "pipeline" || path === "multi-exec") {
      if (path === "multi-exec") await redis.send(["MULTI"]);
      const pending = payload.map((cmd) => redis.send(cmd.map(String)));
      if (path === "multi-exec") {
        await Promise.all(pending);
        const execd = await redis.send(["EXEC"]);
        out = (execd ?? []).map((r) => (r instanceof RespError ? { error: r.message } : { result: encode(r, b64) }));
      } else {
        out = (await Promise.all(pending)).map((r) =>
          r instanceof RespError ? { error: r.message } : { result: encode(r, b64) }
        );
      }
    } else {
      // Single command: body array, or path segments (GET /get/key)
      const cmd = Array.isArray(payload) && payload.length ? payload : path.split("/").map(decodeURIComponent);
      out = await run(cmd.map((a) => (typeof a === "string" ? a : String(a))), b64);
      if (out.error) status = 400;
    }
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(out));
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(`upstash-shim listening on http://127.0.0.1:${PORT} → redis ${REDIS_HOST}:${REDIS_PORT}`);
  });
