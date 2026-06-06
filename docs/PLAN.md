# BlackVault — Engineering Plan

This is the living plan for BlackVault. It captures **what we're building, why,
and in what order**, and indexes the per-change tech-design docs in
[`docs/design/`](./design/).

> **Working agreement:** every substantive change ships with (1) automated tests
> and (2) a tech-design doc in `docs/design/NNNN-*.md`, linked from the status
> table below. Designs are written *before or alongside* the code, not after.

---

## 1. Thesis — what BlackVault is (and is not)

BlackVault is **the security & governance layer for AI-agent credentials.**

The crowded, undifferentiated framing is "another LLM gateway/router"
(LiteLLM, OpenRouter, Portkey, Cloudflare/Vercel AI Gateway, …). We do **not**
compete there. Our defensible wedge is the thing that made a secrets-management
audience take notice: **scoped tokens, an instant kill switch, audit, and keys
the agent never sees** — the agent-era equivalent of what Infisical does for
human and service secrets.

Concretely, the strategy is to generalise from *"firewall for LLM API keys"* to
*"firewall for any credential an AI agent uses"* — with **MCP** (the emerging
standard for agent↔tool connectivity) as the headline expansion.

**Design principles**

- Security claims must be **true under concurrency**, not just on the happy path.
- Degrade gracefully (no Redis ⇒ best-effort, never hard-down).
- The proxy is on the hot path: per-request overhead must be minimal and only
  paid when a feature (budget, rate limit, restriction) is actually configured.
- Backward-compatible by default; no surprise schema/env churn.

---

## 2. Roadmap

### Phase 0 — Core hardening ✅ (shipped)

Make the existing promises true and testable before building anything new.
See [`design/0001-core-hardening.md`](./design/0001-core-hardening.md).

- [x] Real-time, atomic, concurrency-safe **budget enforcement** (reserve & reconcile).
- [x] **Tool-calling + multimodal** translation in the universal gateway (Anthropic & Google, request/response/streaming).
- [x] **Test foundation** (Vitest, 38 unit tests over the security-critical core) + **CI** (lint · typecheck · test).
- [x] `SECURITY.md` + responsible-disclosure policy.
- [x] Remove the unreferenced 2.4 GB vendored `infisical/` fork from the repo.

### Phase 1 — MCP credential broker 🚧 (in progress, headline)

Turn the vault + `bvt_` tokens + kill switch + rate limits + audit into the
security layer for **MCP**, so agents never receive a raw credential and a
single agent's access can be revoked instantly.
See [`design/0002-mcp-credential-broker.md`](./design/0002-mcp-credential-broker.md).

- [x] **Increment 1** — MCP gateway endpoint (`/api/mcp`) authenticated by `bvt_`
      tokens, exposing governed `list_models` + `chat` tools; reuses kill switch,
      rate limits, budget, audit. + README quickstart for Claude Desktop / Cursor.
- 🚧 **Increment 2 — Egress Firewall** ("give an agent a credential it can't
      steal or misuse"). See [`design/0003-egress-firewall.md`](./design/0003-egress-firewall.md).
  - [x] Deterministic policy evaluator + glob matcher + 15 tests (`egress-policy.ts`).
  - [x] Egress proxy route `/api/egress/<path>` — host-pinned credential injection,
        policy gate, audit of allowed+blocked attempts; target config in
        `vaultKeys.metadata` (no migration). `egress-target.ts` + 12 tests.
  - [ ] Create-target tRPC mutation + vault UI (register baseUrl/auth/policy, mint token). ← next
  - [ ] MCP `http_request` tool through the same evaluator.
  - [ ] Auto-kill on N violations + live allow/block audit feed + the demo gif.
- [ ] **Increment 3** — proxy upstream remote MCP servers with injected creds +
      per-token tool allowlist.

### Phase 2 — Observability & trust

- [ ] Usage analytics dashboard (cost / latency / tokens over time).
- [ ] Webhook & email alerts on budget thresholds and rate-limit trips.
- [ ] Cost **reconciliation** against provider billing (replace the static estimate).

### Phase 3 — "Real vault" credibility

- [ ] Envelope encryption + KMS option; **master-key rotation** without re-encrypting downtime.
- [ ] Team workspaces / shared vaults with role-based access.
- [ ] SOC2-aligned audit-log export.

### Backlog / opportunistic

- [ ] More OpenAI-compatible providers (Groq, Mistral, Together) — only as pull, not push.
- [ ] Per-token endpoint scoping for the raw proxy.
- [ ] Decide whether the agent-registry / workflows marketplace stays (it dilutes the security story — candidate to hide or split out).

---

## 3. Status index

| Design | Title | Status |
|---|---|---|
| [0001](./design/0001-core-hardening.md) | Core hardening (budget · tools · tests/CI) | ✅ Implemented |
| [0002](./design/0002-mcp-credential-broker.md) | MCP credential broker | ✅ Inc 1 implemented |
| [0003](./design/0003-egress-firewall.md) | Egress firewall (agent credential firewall) | 🚧 Policy engine implemented |

---

## 4. Known issues & follow-ups (carried from Phase 0)

- **Cost is estimated**, not reconciled with provider billing — see Phase 2.
- **Budget seed** reads a ≤60 s-stale cached DB total on a cold Redis key;
  self-corrects on subsequent requests.
- **Universal gateway cross-key resolution**: a token bound to vault key A can
  spend on any of the user's active keys for a routed provider. Convenient, but
  it means a token isn't strictly scoped to one credential — consider an
  explicit opt-in flag (Phase 1/2).
- **Single static `VAULT_MASTER_KEY`** with no rotation path — see Phase 3.
- `npm audit` reports transitive advisories — triage during dependency bumps.
- **Lint is advisory in CI** (typecheck + test are the hard gates) because of
  pre-existing React-Compiler findings in dashboard UI that need behaviour-aware
  refactors + manual UI testing. Clear these, then make lint blocking:
  - `dashboard/page.tsx:53` & `vault/page.tsx:1048` — `Date.now()` called during
    render (impure); move the relative-time calc out of render.
  - `settings/page.tsx:36` — `setState` synchronously inside an effect mirroring
    server data into form state; adopt a render-key or guarded pattern.
