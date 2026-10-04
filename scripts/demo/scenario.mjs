#!/usr/bin/env node
/**
 * BlackVault end-to-end demo. Drives the real app (next dev) through every
 * guarantee it advertises and asserts each one. Started by scripts/demo/run.sh.
 *
 * Env: APP_URL, SHIM_URL, DATABASE_URL, TOKENS (JSON from seed.mjs)
 */
import pg from "pg";
import { createHash } from "node:crypto";

const APP = process.env.APP_URL ?? "http://127.0.0.1:3100";
const SHIM = process.env.SHIM_URL ?? "http://127.0.0.1:8079";
const SHIM_TOKEN = process.env.SHIM_TOKEN ?? "dev";
const { tokens } = JSON.parse(process.env.TOKENS);
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

let failures = 0;
const ok = (cond, msg) => {
  console.log(`  ${cond ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${msg}`);
  if (!cond) failures++;
};
const step = (title) => console.log(`\n\x1b[1m${title}\x1b[0m`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const usd = (n) => `$${Number(n).toFixed(6)}`;

const BODY = { model: "gpt-4o-mini", messages: [{ role: "user", content: "hi" }], max_tokens: 50 };

async function chat(token, body = BODY) {
  const start = performance.now();
  const res = await fetch(`${APP}/api/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { res, text, ms: performance.now() - start };
}

async function sessionRow(token) {
  const hash = createHash("sha256").update(token).digest("hex");
  const { rows } = await db.query(
    `select s.id, s.total_cost, s.total_requests, s.max_budget,
            (select coalesce(sum(estimated_cost), 0) from proxy_logs l where l.session_id = s.id) as logged_cost
       from proxy_sessions s where token_hash = $1`,
    [hash]
  );
  return rows[0];
}

async function redisCmd(cmd) {
  await fetch(SHIM, { method: "POST", headers: { Authorization: `Bearer ${SHIM_TOKEN}` }, body: JSON.stringify(cmd) });
}

// Warm up route compilation (next dev compiles on first hit).
await chat(tokens.main);
await fetch(`${APP}/api/health`);

// ── 0. Health ────────────────────────────────────────────────────────────────
step("0. Health endpoint");
{
  const res = await fetch(`${APP}/api/health`);
  const body = await res.json();
  ok(res.status === 200 && body.status === "ok", `GET /api/health → ${res.status} ${body.status} (db ${body.checks.database.latencyMs}ms, redis ${body.checks.redis.latencyMs}ms)`);
}

// ── 1. Key isolation ────────────────────────────────────────────────────────
step("1. The agent holds a bvt_ token; the real key never leaves the vault");
{
  const { res, text } = await chat(tokens.main);
  const reply = JSON.parse(text).choices?.[0]?.message?.content ?? text;
  ok(res.status === 200, `chat via bvt_ token → ${res.status}: "${reply.trim()}"`);
  ok(res.headers.get("x-blackvault-session") !== null, `response carries X-BlackVault-Session`);
  const bad = await chat("bvt_" + "0".repeat(64));
  ok(bad.res.status === 401 && bad.ms < 1000, `unknown token → ${bad.res.status} in ${bad.ms.toFixed(0)}ms`);
}

// ── 2. Model restriction ────────────────────────────────────────────────────
step("2. Model allowlist (token restricted to gpt-4o-mini)");
{
  const allowed = await chat(tokens.restricted);
  ok(allowed.res.status === 200, `gpt-4o-mini → ${allowed.res.status}`);
  const denied = await chat(tokens.restricted, { ...BODY, model: "gpt-4o" });
  ok(denied.res.status === 403, `gpt-4o → ${denied.res.status} (${JSON.parse(denied.text).error.code})`);
}

// ── 3. Rate limit ────────────────────────────────────────────────────────────
step("3. Per-token rate limit (5 requests/minute)");
{
  const codes = [];
  let retryAfter = null;
  for (let i = 0; i < 7; i++) {
    const { res } = await chat(tokens.rpm);
    codes.push(res.status);
    if (res.status === 429) retryAfter = Number(res.headers.get("retry-after"));
  }
  ok(codes.slice(0, 5).every((c) => c === 200) && codes.slice(5).every((c) => c === 429), `7 requests → ${codes.join(" ")}`);
  ok(retryAfter > 0 && retryAfter <= 60, `Retry-After: ${retryAfter}s (sane seconds, not epoch-ms garbage)`);
}

// ── 4. Budget, sequential ────────────────────────────────────────────────────
step("4. Budget cap $0.0002 — sequential requests");
{
  const codes = [];
  for (let i = 0; i < 10; i++) codes.push((await chat(tokens.budget)).res.status);
  await sleep(500); // after() writes land post-response
  const row = await sessionRow(tokens.budget);
  const allowed = codes.filter((c) => c === 200).length;
  const perRequest = Number(row.total_cost) / allowed;
  ok(codes.includes(402) && codes.indexOf(402) === allowed, `10 requests → ${allowed}×200 then 402 (${codes.join(" ")})`);
  ok(Number(row.total_cost) > 0, `DB recorded spend ${usd(row.total_cost)} (old numeric(10,4) column would have rounded every $${perRequest.toFixed(7)} request to $0.0000)`);
  ok(Math.abs(Number(row.total_cost) - Number(row.logged_cost)) < 1e-8, `session total == sum of request log (${usd(row.logged_cost)})`);
  const overshoot = Number(row.total_cost) - Number(row.max_budget);
  ok(overshoot < perRequest + 1e-9, `overshoot ${usd(Math.max(0, overshoot))} ≤ one request (${usd(perRequest)}) — the cap crossing request finishes, the next is refused`);
}

// ── 5. Budget, concurrent burst ─────────────────────────────────────────────
step("5. Budget cap $0.0002 — 20 concurrent requests (atomic reservation)");
{
  const results = await Promise.all(Array.from({ length: 20 }, () => chat(tokens.burst)));
  await sleep(800);
  const codes = results.map((r) => r.res.status);
  const allowed = codes.filter((c) => c === 200).length;
  const row = await sessionRow(tokens.burst);
  const perRequest = Number(row.total_cost) / allowed;
  ok(allowed > 0 && allowed < 20 && codes.filter((c) => c === 402).length === 20 - allowed, `20 parallel → ${allowed} allowed, ${20 - allowed} refused with 402`);
  ok(Number(row.total_cost) - Number(row.max_budget) < perRequest + 1e-9, `final spend ${usd(row.total_cost)} vs cap ${usd(row.max_budget)} — concurrent requests see each other's reservations`);
}

// ── 6. Streaming usage ───────────────────────────────────────────────────────
step("6. Streaming — usage chunk split across network packets is still billed");
{
  const { res, text } = await chat(tokens.stream, { ...BODY, stream: true });
  await sleep(300);
  const row = await sessionRow(tokens.stream);
  ok(res.status === 200 && text.includes("[DONE]"), `stream completed (${text.split("\n\n").length - 1} SSE events)`);
  ok(Number(row.total_cost) > 0, `stream billed ${usd(row.total_cost)} (the old per-chunk parser dropped the split usage line → $0)`);
}

// ── 7. Kill switch ───────────────────────────────────────────────────────────
step("7. Kill switch — revoke one agent, everyone else keeps working");
{
  ok((await chat(tokens.kill)).res.status === 200, `agent-kill works before revocation`);
  const hash = createHash("sha256").update(tokens.kill).digest("hex");
  await db.query(`update proxy_sessions set is_active = false where token_hash = $1`, [hash]);
  await redisCmd(["del", `proxy:session:${hash}`]); // what invalidateProxySession() does
  const after = await chat(tokens.kill);
  ok(after.res.status === 403, `next request → ${after.res.status} "${JSON.parse(after.text).error.message}"`);
  ok((await chat(tokens.main)).res.status === 200, `agent-main unaffected → 200 (same real key, no rotation)`);
}

// ── 8. Redis dies ────────────────────────────────────────────────────────────
step("8. Redis dies — bounded latency, visible degradation, recovery");
{
  await fetch(`${SHIM}/__chaos/refuse`, { method: "POST" });
  const first = await chat(tokens.main);
  const next = [];
  for (let i = 0; i < 5; i++) next.push(await chat(tokens.main));
  const worst = Math.max(...next.map((r) => r.ms));
  ok(first.res.status === 200 && first.ms < 2500, `first request after outage: ${first.res.status} in ${first.ms.toFixed(0)}ms (was ~9,600ms on the live site)`);
  ok(next.every((r) => r.res.status === 200) && worst < 500, `next 5 requests: worst ${worst.toFixed(0)}ms — circuit open, Redis skipped`);
  ok(next[0].res.headers.get("x-blackvault-degraded") === "redis", `responses flag X-BlackVault-Degraded: redis`);
  const health = await fetch(`${APP}/api/health`);
  const hb = await health.json();
  ok(health.status === 503 && hb.status === "degraded", `/api/health → ${health.status} ${hb.status} (an uptime monitor would page you)`);

  await fetch(`${SHIM}/__chaos/ok`, { method: "POST" });
  const healed = await fetch(`${APP}/api/health`);
  const after = await chat(tokens.main);
  ok(healed.status === 200 && !after.res.headers.get("x-blackvault-degraded"), `Redis back → health ${healed.status}, degraded flag cleared`);
}

await db.end();
console.log(failures === 0 ? `\n\x1b[32mAll checks passed.\x1b[0m` : `\n\x1b[31m${failures} check(s) failed.\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
