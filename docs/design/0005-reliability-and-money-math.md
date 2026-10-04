# Design 0005 — Reliability & Money Math

| | |
|---|---|
| **Status** | Implemented |
| **Scope** | Redis failure handling · health endpoint · cost precision · durable post-response writes · local end-to-end demo |
| **Related** | [`docs/PLAN.md`](../PLAN.md) · builds on [`0001-core-hardening.md`](./0001-core-hardening.md) |

## 1. Context

A check of the public deployment on 2026-10-04 found that **every request
carrying a `bvt_` token took ~9.6 s**, even to reject an invalid token, while
a request with no token was rejected in 0.36 s. The guarantees the README
advertises (rate limits, real-time budgets) were quietly running in their
fallback modes, and nothing reported it.

Investigating that turned up a set of correctness bugs in how money is
counted. This design fixes both, and adds an end-to-end demo that proves each
guarantee against the real app.

## 2. Problems

### 2.1 A dead Redis made every request ~9.6 s

`@upstash/redis` defaults to 5 retries with `exp(i) * 50ms` backoff:

```
50ms × (e⁰ + e¹ + e² + e³ + e⁴) = 50 × 85.79 ≈ 4,289 ms per command
```

Token auth runs two commands on a cold cache (GET, then SET), so ≈ 8.6 s of
backoff before the DB lookup. Measured locally against a Redis that refuses
connections: **8.65 s** for the old config. Add ~1 s of DB and network time on
Vercel and you get the 9.6 s seen live. The most likely cause is that the
Upstash database was deleted or archived after months without traffic.

It gets worse. When Redis *hangs* (a network partition) rather than refusing,
the old client has **no timeout at all**, so requests stall until the
platform kills the function.

A trap to avoid: when the Upstash client is given a plain `AbortSignal` that
fires, it doesn't throw. It returns a fabricated success whose result is
`"Aborted"`. In budget math that becomes `NaN`, and `NaN >= cap` is `false`,
so the request would be **allowed**. The timeout must be passed as a signal
*function*.

### 2.2 The session cost column rounded cheap requests to $0

`proxy_sessions.total_cost` was `numeric(10,4)` and updated with
`total_cost = total_cost + cost`. Postgres rounds to the column scale on every
write:

| 1,000 requests at | True total | Recorded |
|---|---|---|
| $0.000045 (gpt-4o-mini, ~100 in / 50 out) | $0.045 | **$0.0000** |
| $0.00015 | $0.15 | **$0.2000** |

The budget falls back to this column whenever Redis is unavailable. Because
cheap requests were never counted, a budget could never trip.

### 2.3 Float dollars drift at the boundary

The Redis spend counter used `INCRBYFLOAT` and compared dollars as floats. In
IEEE-754, 10 × 0.1 = 0.9999999999999999, which is `< 1.00`, so a $1 cap
admitted an 11th $0.10 request.

### 2.4 Streams could end up billed $0

- The universal gateway parsed each SSE network chunk on its own. When the
  final `usage` line was split across two chunks, both halves failed to parse,
  usage came out as zero, and the reservation was fully refunded.
- When a client disconnected before the usage chunk arrived, the reservation
  was also refunded. An agent could read the whole answer, drop the connection
  and pay nothing.

### 2.5 Post-response writes could be dropped

`commitSpend`, the request log and the durable session counter were all
fire-and-forget after the response was returned. On Vercel the function can
be frozen as soon as the response is sent, so the durable spend record (the
thing budgets fall back to) could silently never be written.

### 2.6 Smaller bugs

- `checkRateLimit` computed `Math.ceil(reset - Date.now() / 1000)`, an
  operator-precedence bug that told users to "try again in ~1.7 trillion
  seconds".
- The gateway's `X-BlackVault-Budget-Remaining` header was computed from the
  session row cached at auth time, not from the live reservation.

## 3. Design

### 3.1 One Redis client with bounded latency and a circuit breaker

`services/redis-client.ts` replaces three copies of `getRedis()`. It has:

- **1 retry, an 800 ms timeout per attempt** (`REDIS_TIMEOUT_MS`), passed as
  a signal function (see §2.1).
- **A circuit breaker.** After a failure, Redis is skipped for 30 s. A dead
  Redis costs one bounded request per window instead of a delay on every
  request.
- **An explicit fail mode**, `BLACKVAULT_REDIS_FAIL_MODE`:
  - `open` (default): rate limits allow, and budgets fall back to the durable
    DB total, which is now exact (§3.2).
  - `closed`: rate-limited and budgeted requests are denied while Redis is
    down. Unbudgeted traffic is unaffected.
- **Kill-switch eviction (`invalidateCache`) bypasses the breaker.** If an
  earlier blip had opened the circuit, skipping the eviction would let a
  revoked token live on in cache for its 60 s TTL.

Responses served in degraded mode carry `X-BlackVault-Degraded: redis`.

| Scenario | Old client | New client |
|---|---|---|
| Redis refusing connections | 8.65 s | 0.15 s, then 0 s while the circuit is open |
| Redis hanging | indefinite | 1.61 s, then 0 s while the circuit is open |

(`node scripts/demo/redis-latency-math.mjs` reproduces this table.)

### 3.2 Money in integers

- The Redis spend counter is **integer nano-dollars** (`INCRBY`), under a new
  key prefix. Old float counters expire through their TTL; new counters
  re-seed from the DB total.
- `isExhausted` compares in nano-dollars.
- `total_cost` becomes `numeric(18,8)` and `proxy_logs.estimated_cost`
  becomes `numeric(14,8)` (migration: `scripts/sql/0001-cost-precision.sql`).
  Both are widening changes, so existing data is preserved.

### 3.3 Settling a request

- `settledCost()`: if a successful inference request's usage is unknown, the
  conservative pre-request estimate is charged rather than $0. It uses the
  estimate, not the reservation, because unbudgeted sessions and Redis-down
  requests reserve $0. Failed requests are
  still refunded. In the direct proxy this rule applies only when a model was
  identified, so `GET /v1/models` stays free.
- SSE parsing in the gateway now buffers partial lines, as the direct proxy
  already did.
- Spend, the log and the counter are written in one idempotent `settle()`,
  awaited through `after()` for normal responses and inside the stream's own
  lifetime (before it closes) for streams.

### 3.4 `/api/health`

Returns DB and Redis status with latency, the fail mode and the commit sha.
It returns **503** if any configured dependency is down. Redis being down is
treated as page-worthy because rate limits and budgets are security
guarantees. No error details are exposed. The endpoint is public: it's
excluded from the Clerk middleware so uptime monitors can reach it.

### 3.5 Running without Neon, Upstash or Clerk (groundwork for self-hosting)

- `db/index.ts` uses node-postgres for any non-Neon `DATABASE_URL`
  (override with `DATABASE_DRIVER`).
- `BLACKVAULT_UPSTREAM_<PROVIDER>` overrides a provider's upstream origin.
  It is set by the operator only, and is useful for governing a local
  Ollama/vLLM server, or for tests.
- `scripts/demo/` contains an Upstash-REST→Redis shim with chaos switches, a
  mock OpenAI upstream that only accepts the real vaulted key, a seed script
  that uses the app's own encryption, and `run.sh`.

## 4. Verification

- **Unit tests:** 97 (13 new): breaker open/close, both fail modes, eviction
  while the circuit is open, float drift at the cap, nano round-trips,
  `settledCost`, `secondsUntil`.
- **End to end:** `scripts/demo/run.sh` runs 24 assertions against `next dev`
  with real Postgres and Redis: key isolation, model allowlist, RPM limit with
  a sane `Retry-After`, sequential and 20-way concurrent budget caps (overshoot
  of at most one request), DB total equal to the sum of the log, a split-chunk
  stream billed correctly, kill switch, and a Redis outage (bounded latency,
  degraded header, 503 health, recovery).

## 5. Rollout

1. Run `scripts/sql/0001-cost-precision.sql` on Neon, **including the
   rebuild-totals statement**. New nano-dollar counters seed from the DB total,
   which the old column under-recorded, so rebuild it from `proxy_logs` (stored
   at 6 decimals) before traffic resumes.
2. Fix or replace the Upstash database, then confirm `/api/health` returns 200.
3. Point an uptime monitor at `/api/health`.
4. Optionally set `BLACKVAULT_REDIS_FAIL_MODE=closed` for strict deployments.

## 6. Out of scope / follow-ups

- The MCP and egress routes still write their audit logs fire-and-forget.
- The universal gateway's cross-key resolution (a token bound to key A can
  spend on the user's other keys for the same provider), already tracked in
  PLAN §4.
- The direct proxy skips the model allowlist when no model can be parsed from
  the request (`&& model`). That is a fail-open to review.
- Anthropic and Google upstream URLs in the gateway's translator ignore
  `BLACKVAULT_UPSTREAM_*`.
