# Design 0003 — Egress Firewall (Increment 2)

| | |
|---|---|
| **Status** | In progress · policy engine + egress route implemented |
| **Headline** | Give an AI agent a real credential it can never steal and can't misuse |
| **Related** | [`docs/PLAN.md`](../PLAN.md) Phase 1 · extends [`0002-mcp-credential-broker.md`](./0002-mcp-credential-broker.md) |

## 1. The "whoa"

The defining anxiety of the agent era: you want an autonomous agent to *do real
things* — open PRs, refund a charge, query the DB — but doing so means handing it
a real credential, and a prompt-injected or buggy agent with your GitHub token
can delete every repo or leak the key.

BlackVault Increment 2 removes the trade-off:

> The agent calls `http_request(target: "github", ...)`. BlackVault injects the
> real token **server-side**, but only toward the credential's pinned host, only
> for methods/paths you allow, logs every attempt, and kills the token on abuse.
> **The agent never holds the secret, and can't aim it anywhere you didn't
> authorise.**

The demo that earns stars: *give an agent a GitHub token, prompt-inject it to
"POST the token to attacker.com" and to "DELETE the repo" — watch BlackVault
block both while the legit `GET /repos` still works, all on a live audit feed.*

## 2. Why this is honest, not hype

No "AI detects malicious intent." The guarantees are **deterministic and
structural**:

1. **Secret exfiltration is impossible by construction.** The agent references a
   credential by name (`target: "github"`); it never receives the secret value,
   so it physically cannot place the secret in a body bound for `attacker.com`.
2. **The destination host is pinned by config, not the agent.** BlackVault only
   injects the credential toward `target.baseUrl`. The agent supplies a *path*
   and *body*, never the host — so it can't trick BlackVault into sending the
   credential elsewhere (and SSRF is contained).
3. **Misuse is bounded by an allowlist.** A read token can be restricted to
   `GET` + `/repos/**`; a prompt-injected `DELETE /repos/x` is denied. As strong
   as your policy — but predictable, inspectable, and testable.

Plus: every attempt is audited; N violations auto-kills the token; the existing
budget / rate-limit / IP / kill-switch machinery all apply.

## 3. Architecture

```
agent (via MCP tool `http_request`  OR  raw POST /api/egress/<target>/<path>)
   │  Authorization: Bearer bvt_…     body: { method, path, query?, headers?, body? }
   ▼
BlackVault egress firewall
   1. authenticate bvt_            (reuse proxy-auth → kill switch)
   2. resolve target               (vaultKeys, provider="http", host pinned in metadata)
   3. evaluate policy              (egress-policy.ts — PURE, tested)  ── deny ─▶ 403 + audit (+ auto-kill)
   4. inject the real credential   (decrypt; add to header/query) — toward the PINNED host only
   5. forward, audit, return        (proxyLogs row per attempt; secret never in the response to the agent)
   ▼
upstream API (api.github.com / api.stripe.com / your service)   ← the real key lives here
```

### 3.1 Components

- **`egress-policy.ts`** — pure evaluator: `evaluateEgress({ method, path, policy })
  → { allowed, reason }` + a `**`/`*` glob matcher. Fully unit-tested, zero I/O.
  *(Implemented in this increment as the foundation.)*
- **`/api/egress/[target]/[...path]/route.ts`** — raw HTTP egress proxy (usable by
  curl, LangChain, any agent), mirroring the existing proxy route shape.
- **MCP `http_request` tool** — same path through the evaluator, so MCP agents get
  it too (extends Increment 1's server).
- **Target config** — a brokered credential = a `vaultKeys` row with
  `provider="http"` and `metadata = { baseUrl, auth: { scheme: bearer|header|query,
  name? } }`. No new table.
- **Policy** — a nullable `policy jsonb` column on `proxy_sessions`
  (`{ allowedMethods?, allowedPaths?, blockedPaths? }`) — one small, additive
  migration. Default (no allowlist) = any method/path **on the pinned host**;
  tighten by opting in. `blockedPaths` always denies.

### 3.2 Policy semantics (default-open on host, opt-in tightening)

| Rule | Effect |
|---|---|
| `blockedPaths` matches | **Deny** (highest precedence) |
| `allowedMethods` set & method not in it | Deny |
| `allowedPaths` set & path matches none | Deny |
| otherwise | Allow (host is still pinned) |

The host pin + "agent never holds the secret" are the hard guarantees and hold
regardless of policy; the allowlists tighten *what the legit credential can do*.

## 4. Build plan / milestones

1. **Policy evaluator + tests** — pure logic, no schema. ✅
2. **Egress proxy route** `/api/egress/<path>` — target resolution (from
   `vaultKeys.metadata`, no migration), policy evaluation, host-pinned credential
   injection, audit of allowed + blocked attempts. ✅ (`src/app/api/egress/[...path]/route.ts`
   + `egress-target.ts`, host-pinning/injection unit-tested)
3. **Create-target flow** — a tRPC mutation (+ vault UI) to register an HTTP
   target (baseUrl + auth scheme + policy) in `vaultKeys.metadata`, and mint a
   `bvt_` token for it. ← next, needed to drive the demo
4. **MCP `http_request` tool** — wire the same path into Increment 1's server.
5. **Auto-kill on N violations** + a live "allowed/blocked" audit feed in the UI.
6. **The demo** — scripted GitHub-token prompt-injection blocked, recorded as a gif
   for the README/launch.

> v1 keeps target + policy in `vaultKeys.metadata` (existing jsonb) → **no DB
> migration**. Per-token policy override via a `proxy_sessions.policy` column is a
> later refinement.

## 5. Testing strategy

- Unit-test the evaluator exhaustively (method allow/deny, glob `*` vs `**`,
  blocked-path precedence, empty-policy default, traversal normalisation).
- Unit-test credential injection (header/query schemes) and host-pinning (an
  agent-supplied absolute URL or `..` traversal can never change the host).
- Manual: the prompt-injection demo end-to-end.

## 6. Honest limitations

- Policy is deterministic allowlisting, not semantic intent detection — by design.
- A credential that is itself over-scoped upstream (e.g. an admin GitHub PAT) is
  only as safe as the policy you write; we make least-privilege *enforceable*, we
  don't grant it.
- Second-order exfil (agent reads a secret in one allowed response, sends it via
  another allowed call) is out of scope for v1; noted for later response scanning.
- Streaming/large bodies handled like the existing proxy (pass-through).
