# Design 0002 — MCP Credential Broker

| | |
|---|---|
| **Status** | Increment 1 implemented · Increments 2–3 planned |
| **Scope** | BlackVault as an MCP server; broker vaulted credentials to AI agents with the existing governance stack |
| **Related** | [`docs/PLAN.md`](../PLAN.md) (Phase 1) · builds on [`0001-core-hardening.md`](./0001-core-hardening.md) |

## 1. Thesis

MCP (Model Context Protocol) is the emerging standard for how agents connect to
tools and data — adopted across Anthropic, OpenAI, Google, and the major IDEs.
Its **biggest unsolved problem is credential security**: an MCP server needs a
real secret (a GitHub PAT, a Stripe key, a DB URL), and today that secret is
handed to the agent/host in plaintext with no scoping, no kill switch, no audit,
no budget.

That is *exactly* the problem BlackVault already solves for LLM keys. This design
generalises BlackVault from "firewall for LLM API keys" to **"firewall for any
credential an AI agent uses,"** delivered over the MCP standard:

> The agent connects to BlackVault as an MCP server with a `bvt_` token.
> BlackVault injects the real secret server-side, enforces kill switch / scope /
> rate limit / budget, and audits every call. **The agent never sees the secret.**

## 2. Architecture

```
MCP client (Claude Desktop / Cursor / Claude Code)
   │  JSON-RPC 2.0 over HTTP (Streamable HTTP), Authorization: Bearer bvt_…
   ▼
BlackVault MCP server  /api/mcp
   │  • authenticate bvt_  (reuse proxy-auth.ts → instant kill switch)
   │  • enforce rate limit / scope / budget  (reuse ratelimit.ts, budget.ts)
   │  • audit every tools/call  (reuse proxyLogs / activityLog)
   │  • inject the real vaulted credential  (reuse encryption.ts)
   ▼
Upstream (an AI provider, an HTTP API, or another MCP server)  ← real key lives here
```

**Why this fits BlackVault**

- **Reuses the whole hardened core.** `bvt_` auth + kill switch + rate limits +
  budget + audit + AES-GCM vault all apply unchanged — the MCP layer is a new
  *protocol surface* over the same governance.
- **Serverless-compatible.** Remote MCP over Streamable HTTP is just an HTTP
  route handler on Vercel. (stdio MCP requires long-lived subprocesses and is
  out of scope — not viable on serverless, and not where the security gap is.)

### 2.1 Protocol surface (stateless Streamable HTTP)

A single route `src/app/api/mcp/route.ts` handling JSON-RPC 2.0:

| Method | Behaviour |
|---|---|
| `initialize` | Echo the client's `protocolVersion`; advertise `capabilities.tools`; return `serverInfo`. |
| `notifications/initialized` | Notification → no response (204/empty). |
| `ping` | `{}`. |
| `tools/list` | Tools the token is allowed to use. |
| `tools/call` | Dispatch a tool; enforce governance; inject credential; audit; return `content[]`. |
| unknown | JSON-RPC error `-32601` (method not found). |

The server is **stateless** (the spec permits this): each POST is self-contained,
auth is per-request via the bearer token, no `Mcp-Session-Id` lifecycle. `GET`
(server-initiated SSE) returns `405` — not required for a tool server.

Auth: `Authorization: Bearer bvt_…` (Claude Desktop, Cursor, and `mcp-remote`
all support custom headers for remote servers). A missing/invalid/revoked token
→ JSON-RPC error mapped from `ProxyAuthError`.

## 3. Increments

### Increment 1 — Governed LLM access as an MCP server  ✅ implemented

Zero schema, zero UI changes. Exposes the hardened gateway as MCP tools.
Shipped as `src/app/api/mcp/route.ts` + `src/server/services/mcp/protocol.ts`,
with 10 dispatch unit tests (`__tests__/mcp-protocol.test.ts`). Tools:

- **`list_models`** — the models this token may use (from the user's active vault
  keys, filtered by the session's `allowedModels`).
- **`chat`** — run a completion on any allowed model. Input: `model`, `messages`,
  optional `max_tokens` / `temperature`. BlackVault routes to the right provider,
  injects the vaulted key, and **the existing gateway enforces budget / rate /
  model-allowlist / kill switch and audits the call.**

Reuse strategy: the `chat` tool calls the hardened universal gateway
(`/api/v1/chat/completions`) with the same `bvt_` token, so 100% of the Phase 0
governance applies with zero duplication. (One internal hop; a later refactor
can extract a shared `executeChat()` — tracked as debt.)

**Outcome:** "Add BlackVault to your MCP client and your agent gets governed,
vaulted AI access — your config holds a `bvt_` token, never a provider key, and
your budget cap / kill switch / audit apply to its calls."

### Increment 2 — Generic HTTP credential broker (the "vault ANY secret" leap)

Register an **HTTP target** as a vault key with `provider="http"` and config in
`vaultKeys.metadata` (`{ baseUrl, authScheme: bearer|header|query, headerName,
allowedMethods, allowedPathPrefixes }`) — **no schema migration** (metadata is
existing `jsonb`). Expose:

- **`http_request`** (or one tool per target) — the agent calls an API (GitHub,
  Stripe, internal service); BlackVault injects the vaulted credential, enforces
  method/path allowlist + rate limit + kill switch, and audits it. The agent
  never sees the secret.

Adds a minimal "create HTTP target" flow (tRPC mutation; UI optional at first).
This is the strongest differentiator — "give every agent its own keychain."

### Increment 3 — Upstream MCP proxy (full firewall-for-MCP)

BlackVault acts as an MCP **client** to remote upstream MCP servers, injecting
their credentials, aggregating + namespacing their tools, and enforcing a
per-token tool allowlist. The complete "kill switch in front of any MCP server."

## 4. Security model & scoping

- **Credential confidentiality:** secrets are decrypted server-side and never
  appear in any `tools/list`/`tools/call` response.
- **Kill switch:** reuses `invalidateProxySession` — a revoked token fails its
  next MCP call immediately (cache deleted on kill).
- **Scope:** Increment 1 reuses `allowedModels`. Increments 2–3 add a per-session
  tool/endpoint allowlist (new optional `allowedTools text[]` on `proxy_sessions`).
- **Rate/budget:** reuse `ratelimit.ts` / `budget.ts` keyed by session.
- **Audit:** every `tools/call` writes a `proxyLogs` row (tool name as endpoint).

## 5. Testing strategy

- Unit-test JSON-RPC dispatch: `initialize` shape, `tools/list`, unknown-method
  error `-32601`, malformed-request error `-32600/-32700`, notification handling.
- Unit-test tool registry + input validation (zod schemas per tool) and the
  error-to-JSON-RPC mapping (auth error → proper code).
- `chat` execution tested with a mocked gateway fetch.
- Manual: connect from Claude Desktop / Cursor via a remote MCP config.

## 6. Known limitations / decisions

- Increment 1's internal hop (MCP → gateway over HTTP) trades a little latency
  for zero governance duplication; refactor to a shared function later.
- Stateless server: no resumable SSE / server-initiated notifications (not needed
  for a tool server).
- Protocol-version negotiation: echo the client's version; pin a default if absent.
- Client header support varies; document the exact config for Claude Desktop,
  Cursor, and Claude Code.
