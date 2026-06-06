import { describe, it, expect, vi } from "vitest";
import {
  dispatch,
  MCP_PROTOCOL_VERSION,
  RPC,
  type JsonRpcRequest,
  type McpServer,
  type McpTool,
} from "../mcp/protocol";

function makeServer(tools: McpTool[] = []): McpServer {
  return { name: "blackvault", version: "0.1.0", tools };
}

const echoTool: McpTool = {
  name: "echo",
  description: "echoes",
  inputSchema: { type: "object", properties: { text: { type: "string" } } },
  handler: async (args) => ({ content: [{ type: "text", text: String(args.text ?? "") }] }),
};

describe("mcp dispatch", () => {
  it("handles initialize and echoes the requested protocol version", async () => {
    const res = await dispatch(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } },
      makeServer()
    );
    expect(res?.result).toMatchObject({
      protocolVersion: "2025-03-26",
      capabilities: { tools: {} },
      serverInfo: { name: "blackvault" },
    });
  });

  it("defaults the protocol version when the client omits it", async () => {
    const res = await dispatch({ jsonrpc: "2.0", id: 1, method: "initialize" }, makeServer());
    expect((res?.result as { protocolVersion: string }).protocolVersion).toBe(MCP_PROTOCOL_VERSION);
  });

  it("answers ping with an empty result", async () => {
    const res = await dispatch({ jsonrpc: "2.0", id: 2, method: "ping" }, makeServer());
    expect(res).toEqual({ jsonrpc: "2.0", id: 2, result: {} });
  });

  it("returns no response for notifications (e.g. notifications/initialized)", async () => {
    const res = await dispatch(
      { jsonrpc: "2.0", method: "notifications/initialized" } as JsonRpcRequest,
      makeServer()
    );
    expect(res).toBeNull();
  });

  it("lists tools", async () => {
    const res = await dispatch({ jsonrpc: "2.0", id: 3, method: "tools/list" }, makeServer([echoTool]));
    const tools = (res?.result as { tools: Array<{ name: string }> }).tools;
    expect(tools.map((t) => t.name)).toEqual(["echo"]);
    expect(tools[0]).toHaveProperty("inputSchema");
  });

  it("dispatches a tools/call to the matching tool handler", async () => {
    const res = await dispatch(
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "echo", arguments: { text: "hi" } } },
      makeServer([echoTool])
    );
    expect(res?.result).toEqual({ content: [{ type: "text", text: "hi" }] });
  });

  it("errors on an unknown tool", async () => {
    const res = await dispatch(
      { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "nope" } },
      makeServer([echoTool])
    );
    expect(res?.error?.code).toBe(RPC.INVALID_PARAMS);
  });

  it("returns an isError result when a tool handler throws (not a protocol error)", async () => {
    const boom: McpTool = {
      name: "boom",
      description: "throws",
      inputSchema: { type: "object" },
      handler: vi.fn(async () => {
        throw new Error("kaboom");
      }),
    };
    const res = await dispatch(
      { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "boom" } },
      makeServer([boom])
    );
    expect(res?.error).toBeUndefined();
    expect(res?.result).toEqual({ content: [{ type: "text", text: "kaboom" }], isError: true });
  });

  it("errors with METHOD_NOT_FOUND on an unknown request method", async () => {
    const res = await dispatch({ jsonrpc: "2.0", id: 7, method: "does/not/exist" }, makeServer());
    expect(res?.error?.code).toBe(RPC.METHOD_NOT_FOUND);
  });

  it("rejects a malformed request that carries an id", async () => {
    const res = await dispatch({ id: 8, method: "ping" } as unknown as JsonRpcRequest, makeServer());
    expect(res?.error?.code).toBe(RPC.INVALID_REQUEST);
  });
});
