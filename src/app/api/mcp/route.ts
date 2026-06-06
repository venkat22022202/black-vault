import { NextRequest, NextResponse } from "next/server";
import { authenticateProxyRequest, ProxyAuthError } from "@/server/services/proxy-auth";
import {
  dispatch,
  type JsonRpcRequest,
  type McpServer,
  type McpTool,
} from "@/server/services/mcp/protocol";

/**
 * BlackVault MCP server — a stateless, Streamable-HTTP MCP endpoint that gives
 * any MCP client (Claude Desktop, Cursor, Claude Code, …) *governed* access to
 * the user's vaulted AI keys. The client config holds a `bvt_` token, never a
 * provider key; budget caps, rate limits, model restrictions, the kill switch
 * and the audit trail all apply (enforced by the hardened universal gateway).
 *
 * See docs/design/0002-mcp-credential-broker.md.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

const SERVER_INFO = { name: "blackvault", version: "0.1.0" };

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Build the tool set for a request. Tools call the hardened gateway with the
 * caller's own `bvt_` token, so 100% of the Phase-0 governance applies with no
 * duplication. (One internal hop; a shared executeChat() refactor is tracked.)
 */
function buildTools(token: string): McpTool[] {
  const authHeader = { Authorization: `Bearer ${token}` };

  const listModels: McpTool = {
    name: "list_models",
    description:
      "List the AI models this BlackVault token is allowed to use (across all vaulted provider keys).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async handler() {
      const res = await fetch(`${appUrl()}/api/v1/models`, { headers: authHeader });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          content: [{ type: "text", text: data?.error?.message ?? `Failed to list models (${res.status})` }],
          isError: true,
        };
      }
      const ids: string[] = (data.data ?? []).map((m: { id: string }) => m.id);
      return {
        content: [
          {
            type: "text",
            text: ids.length
              ? ids.join("\n")
              : "No models available. Add a provider key to your BlackVault vault.",
          },
        ],
      };
    },
  };

  const chat: McpTool = {
    name: "chat",
    description:
      "Run a chat completion on any allowed model (gpt-*, claude-*, gemini-*, open-source via Nebius). " +
      "BlackVault injects the real provider key, enforces budget/rate/model limits, and audits the call.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string", description: "Model id, e.g. gpt-4o, claude-sonnet-4-5-20250929, gemini-2.0-flash" },
        messages: {
          type: "array",
          description: "OpenAI-style chat messages.",
          items: {
            type: "object",
            properties: {
              role: { type: "string", enum: ["system", "user", "assistant"] },
              content: { type: "string" },
            },
            required: ["role", "content"],
          },
        },
        max_tokens: { type: "number" },
        temperature: { type: "number" },
      },
      required: ["model", "messages"],
      additionalProperties: false,
    },
    async handler(args) {
      const model = args.model;
      const messages = args.messages;
      if (typeof model !== "string" || !Array.isArray(messages)) {
        return {
          content: [{ type: "text", text: "`model` (string) and `messages` (array) are required." }],
          isError: true,
        };
      }
      const payload: Record<string, unknown> = { model, messages };
      if (typeof args.max_tokens === "number") payload.max_tokens = args.max_tokens;
      if (typeof args.temperature === "number") payload.temperature = args.temperature;

      const res = await fetch(`${appUrl()}/api/v1/chat/completions`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          content: [{ type: "text", text: data?.error?.message ?? `Upstream error (${res.status})` }],
          isError: true,
        };
      }
      const message = data.choices?.[0]?.message ?? {};
      const text: string = message.content ?? "";
      const toolCalls = message.tool_calls;
      const out = toolCalls ? `${text}\n\n[tool_calls]: ${JSON.stringify(toolCalls)}` : text;
      return { content: [{ type: "text", text: out || "(empty response)" }] };
    },
  };

  return [listModels, chat];
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  // Stateless tool server: no server-initiated SSE stream.
  return NextResponse.json(
    { error: "Use POST for MCP JSON-RPC requests." },
    { status: 405, headers: CORS_HEADERS }
  );
}

export async function POST(request: NextRequest) {
  // ── Authenticate (reuses bvt_ auth → instant kill switch) ──
  try {
    await authenticateProxyRequest(request);
  } catch (e) {
    const status = e instanceof ProxyAuthError ? e.statusCode : 500;
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32001, message: e instanceof Error ? e.message : "Authentication failed" },
      },
      { status, headers: CORS_HEADERS }
    );
  }

  const token = (request.headers.get("authorization") ?? "").slice(7); // strip "Bearer "

  // ── Parse JSON-RPC body ──
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 200, headers: CORS_HEADERS }
    );
  }

  const server: McpServer = { ...SERVER_INFO, tools: buildTools(token) };

  // The 2025-06-18 spec dropped batching, but we tolerate arrays defensively.
  const messages = Array.isArray(body) ? body : [body];
  const responses = [];
  for (const m of messages) {
    const r = await dispatch(m as JsonRpcRequest, server);
    if (r) responses.push(r);
  }

  // Only notifications → no body to return.
  if (responses.length === 0) {
    return new NextResponse(null, { status: 202, headers: CORS_HEADERS });
  }

  const payload = Array.isArray(body) ? responses : responses[0];
  return NextResponse.json(payload, { status: 200, headers: CORS_HEADERS });
}
