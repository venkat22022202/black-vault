# Design 0001 — Core Hardening

| | |
|---|---|
| **Status** | Implemented |
| **Author** | BlackVault maintainers |
| **Scope** | Budget enforcement correctness · cross-provider tool calling · test + CI foundation |
| **Related** | [`docs/PLAN.md`](../PLAN.md) (Phase 0) |

## 1. Context & motivation

BlackVault's pitch is *"the API-key firewall for AI agents"* — scoped proxy
tokens, an instant kill switch, and per-token **budget caps** ("$5 so an agent
can't burn $500 overnight"). Two of those headline guarantees were not actually
true under realistic load, and the project had **no automated tests** to catch
regressions in security-critical code. Before building anything new on top of
this foundation, we make the existing claims true and testable.

This design covers three changes shipped together:

1. **Real-time, concurrency-safe budget enforcement.**
2. **Tool-calling + multimodal support in the universal gateway's format translator.**
3. **A test + CI foundation** for the security-critical core.

## 2. Problem statements

### 2.1 The budget cap leaked

Before this change:

- The proxy authenticated against a **60-second-cached** session row
  (`proxy-auth.ts`), so `totalCost` could be up to 60 s stale.
- The spend counter was incremented **fire-and-forget *after*** the upstream
  response returned (`updateSessionCounters`).

Consequently, a burst of concurrent requests all read the same stale, low
`totalCost`, all passed the `totalCost >= maxBudget` check, and all proceeded.
The documented behaviour ("402 when exhausted") could be blown past by an
**unbounded** amount within the cache window. For a *security* product, a cap
that doesn't hold under concurrency is the worst kind of bug.

### 2.2 The universal gateway silently dropped tool calls

The OpenAI-compatible gateway (`/api/v1/chat/completions`) translates requests
to Anthropic / Google formats. The translator modelled message content as a
plain `string` and ignored `tools`, `tool_choice`, `tool_calls`, tool-result
messages, and multimodal (image) content. Any agent framework
(LangChain / CrewAI / AutoGen — *the target users*) sending a tool-enabled
request to a Claude or Gemini model through the gateway had its tools **silently
discarded**, breaking the agent loop with no error.

(The direct pass-through proxy `/api/proxy/<provider>/…` and OpenAI/Nebius
routes were unaffected — they forward the body verbatim.)

### 2.3 No tests, no CI

Zero automated tests existed for encryption, auth, pricing, routing, or
translation. There was no CI. A security/secrets project that the audience
(experienced devs, a secrets-management CEO) *will* read the source of needs
this as table stakes.

## 3. Goals / non-goals

**Goals**

- Make the budget cap a real cap: bounded overshoot under concurrency,
  enforced against an authoritative counter, degrading gracefully without Redis.
- Make the universal gateway faithfully translate tool calls and image content
  in **both** directions for Anthropic and Google.
- Establish a fast unit-test suite over the security-critical pure logic, run
  in CI on every push/PR.

**Non-goals**

- Reconciling estimated cost against real provider billing (tracked separately;
  cost remains an estimate from a static price table).
- Streaming-level perfect parity for every exotic content type.
- Key rotation / envelope encryption / KMS (future design).
- Integration/E2E tests that require live DB/Redis/provider credentials.

## 4. Design

### 4.1 Budget enforcement — reserve & reconcile

New service: `src/server/services/budget.ts`.

The spend counter becomes **authoritative in Redis** via an atomic
`INCRBYFLOAT`, so concurrent requests observe each other immediately.

**Per request (only when the session has a `maxBudget`):**

1. **Estimate** a conservative upper-bound cost *before* forwarding
   (`estimateRequestCost`): input tokens ≈ `body.length / 4`, output tokens =
   the request's max-output cap (`max_tokens` / `max_completion_tokens` /
   `generationConfig.maxOutputTokens`), falling back to 4096 when unspecified.
2. **Reserve** atomically: `SET key <dbTotal> NX` seeds the counter from the
   durable DB total on a cold cache, then `INCRBYFLOAT(key, estimate)`. The
   *pre-increment* value is the authoritative spend so far.
3. **Decide** (`isExhausted`): if pre-increment spend `>= maxBudget`, refund the
   reservation (`INCRBYFLOAT(key, -estimate)`) and return `402`. Otherwise allow.
4. **Reconcile** after the response (`commitSpend`): `INCRBYFLOAT(key, actual −
   reserved)`. On upstream failure, `actual = 0` fully refunds the reservation.

**Policy:** a *new* request is rejected only once spend has reached the cap
(matching the documented "402 when exhausted"). Because the reservation makes
in-flight requests visible to one another, overshoot is bounded to a **single
boundary-crossing request** instead of an entire burst.

**Degradation:** if Redis is not configured or errors, `reserveBudget` falls
back to a best-effort check against the DB total rather than blocking traffic —
the same posture the rest of the codebase takes toward Redis.

**Integration points:** both `src/app/api/proxy/[provider]/[...path]/route.ts`
and `src/app/api/v1/chat/completions/route.ts` reserve before the upstream
`fetch`, refund on the 502 path, and reconcile in the streaming-done branch and
the non-streaming branch.

#### Alternatives considered

- *Strict pre-cap rejection* (`spent + estimate > cap` ⇒ reject): guarantees zero
  overshoot but causes false rejections near the boundary and when `max_tokens`
  is large. Rejected — worse UX than the documented "block when exhausted".
- *Keep DB as the only counter, just shorten the cache TTL*: still races on the
  fire-and-forget post-response update; doesn't make concurrent requests visible.
- *Distributed lock per session*: serialises a session's requests; unacceptable
  latency for an agent doing parallel calls.

#### Known limitations

- Cost is an **estimate**; a model whose actual price exceeds the table's
  default can still under-reserve. Mitigated by the conservative output default;
  fully addressed only by billing reconciliation (future work).
- The seed reads the (≤60 s stale) cached DB total on a cold Redis key; it
  self-corrects as the counter increments. Acceptable for a first request.

### 4.2 Format translator — tool calling & multimodal

Rewrote `src/server/services/format-translator.ts` to model the full OpenAI
chat shape: `content` may be a string, an array of parts (text / `image_url`),
or `null`; messages may carry `tool_calls` (assistant) or be `role:"tool"`
results; requests may carry `tools` and `tool_choice`.

**Request translation (OpenAI → provider):**

| OpenAI concept | Anthropic | Google (Gemini) |
|---|---|---|
| `system` message | `system` field | `systemInstruction` |
| `tools[].function` | `tools[].{name,description,input_schema}` | `tools[0].functionDeclarations[]` |
| `tool_choice: auto/required/none` | `{type: auto/any/none}` | `functionCallingConfig.mode: AUTO/ANY/NONE` |
| `tool_choice: {function:{name}}` | `{type:"tool", name}` | `mode: ANY` + `allowedFunctionNames` |
| assistant `tool_calls` | `tool_use` content block | `functionCall` part (role `model`) |
| `role:"tool"` result | `tool_result` block (user turn) | `functionResponse` part (user turn) |
| `image_url` (data URL) | `image` block, `base64` source | `inlineData {mimeType,data}` |
| `image_url` (remote URL) | `image` block, `url` source | `fileData {fileUri}` |

Consecutive same-role messages are merged so Anthropic/Gemini see properly
alternating turns. Tool-result names for Gemini are recovered by mapping
`tool_call_id → function name` from the preceding assistant `tool_calls`.

**Response translation (provider → OpenAI):** `tool_use` / `functionCall`
blocks become OpenAI `tool_calls`; `finish_reason` becomes `"tool_calls"` when
the model requested a tool, mapping `max_tokens`→`"length"` otherwise.

**Streaming:** the Anthropic SSE translator now emits OpenAI `tool_calls` deltas
(opening chunk with `id`+`name`, then `input_json_delta` → `function.arguments`
fragments); the Google translator emits a full `tool_calls` delta when a
`functionCall` part appears. The existing text-delta path is unchanged.

### 4.3 Test & CI foundation

- **Vitest** (`vitest.config.ts`, `node` env, `include: src/**/*.test.ts`).
  Scripts: `test`, `test:watch`, `typecheck`.
- **38 unit tests** in `src/server/services/__tests__/` covering:
  - `encryption` — round-trip, random IV, per-user/per-key isolation, GCM tamper
    rejection, missing master key.
  - `format-translator` — tools, tool results, multimodal, both response directions.
  - `proxy-pricing` — known/unknown model pricing, token & max-output estimation.
  - `budget` — `isExhausted` policy + the no-Redis fallback paths.
  - `model-router` — provider routing for every prefix family.
- **CI** (`.github/workflows/ci.yml`): `npm ci` → lint → typecheck → test on
  push/PR to `main`, with concurrency cancellation.
- The vendored `infisical/` fork (2.4 GB, unreferenced) was removed from the
  working tree and gitignored; `tsconfig.json` excludes it as a safety net so a
  re-clone can't pull it back into the app's compilation.

## 5. Testing strategy

Unit tests target **pure, deterministic logic** — the layer where security bugs
hide and where tests pay off without infrastructure. Redis/DB-backed paths are
exercised through their deterministic fallback (Redis unconfigured) and through
extracted pure helpers (`isExhausted`, the estimators). Live integration tests
(real provider streaming, Redis atomicity under contention) are deferred to a
future harness that can stand up Upstash + a test DB.

## 6. Rollout & verification

- `npm test` → 38 passing. `npm run typecheck` → clean. `npm run lint` → clean.
- No schema or env changes required; behaviour is backward-compatible.
- The budget counter seeds itself from existing `proxy_sessions.total_cost`, so
  in-flight sessions transition transparently on first request after deploy.
