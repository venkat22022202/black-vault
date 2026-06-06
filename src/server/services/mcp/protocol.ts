/**
 * MCP (Model Context Protocol) — JSON-RPC 2.0 dispatch core.
 *
 * Pure, transport-agnostic dispatch so it can be unit-tested without HTTP/DB.
 * The route layer (`src/app/api/mcp/route.ts`) handles auth, builds the tool
 * set with the request's credentials in closure, and calls `dispatch`.
 *
 * Implements a stateless Streamable-HTTP MCP server surface: initialize,
 * notifications/initialized, ping, tools/list, tools/call.
 */

/** Default protocol version advertised when a client doesn't request one. */
export const MCP_PROTOCOL_VERSION = "2025-06-18";

/** Standard JSON-RPC 2.0 error codes. */
export const RPC = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

export interface McpToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface McpTool {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments. */
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<McpToolResult>;
}

export interface McpServer {
  name: string;
  version: string;
  tools: McpTool[];
}

function ok(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function err(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

/** A message with no `id` is a JSON-RPC notification — it gets no response. */
export function isNotification(msg: { id?: unknown }): boolean {
  return msg.id === undefined;
}

/**
 * Dispatch a single JSON-RPC message. Returns the response, or `null` for
 * notifications (which must not be answered).
 */
export async function dispatch(
  msg: JsonRpcRequest,
  server: McpServer
): Promise<JsonRpcResponse | null> {
  // Structural validation.
  if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    // Can't safely answer a malformed notification; only error on things with an id.
    if (msg && typeof msg === "object" && "id" in msg && msg.id !== undefined) {
      return err(msg.id ?? null, RPC.INVALID_REQUEST, "Invalid Request");
    }
    return null;
  }

  // Notifications (e.g. notifications/initialized) get no response.
  if (isNotification(msg)) return null;

  const id = msg.id ?? null;

  switch (msg.method) {
    case "initialize": {
      const requested = (msg.params?.protocolVersion as string) || MCP_PROTOCOL_VERSION;
      return ok(id, {
        protocolVersion: requested,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: server.name, version: server.version },
      });
    }

    case "ping":
      return ok(id, {});

    case "tools/list":
      return ok(id, {
        tools: server.tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });

    case "tools/call": {
      const name = msg.params?.name;
      if (typeof name !== "string") {
        return err(id, RPC.INVALID_PARAMS, "tools/call requires a string 'name'");
      }
      const tool = server.tools.find((t) => t.name === name);
      if (!tool) {
        return err(id, RPC.INVALID_PARAMS, `Unknown tool: ${name}`);
      }
      const args = (msg.params?.arguments as Record<string, unknown>) ?? {};
      try {
        const result = await tool.handler(args);
        return ok(id, result);
      } catch (e) {
        // Per MCP, tool *execution* errors are returned as isError results,
        // not JSON-RPC protocol errors, so the model can see and react to them.
        return ok(id, {
          content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }],
          isError: true,
        });
      }
    }

    default:
      return err(id, RPC.METHOD_NOT_FOUND, `Method not found: ${msg.method}`);
  }
}
