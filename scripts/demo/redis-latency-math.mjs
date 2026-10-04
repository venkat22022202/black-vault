#!/usr/bin/env node
/**
 * Why did every token request on the live site take ~9.6s?
 *
 * The default @upstash/redis client retries a failed request 5 times, sleeping
 * exp(i) * 50ms between attempts:  50 * (e^0 + e^1 + e^2 + e^3 + e^4) ≈ 4,289ms
 * per command. Token auth does two commands on a cold cache (GET, then SET),
 * so a dead Redis costs ~8.6s of pure backoff before the DB lookup even counts.
 *
 * This script measures it against the upstash-shim's chaos modes, comparing the
 * old client config with BlackVault's hardened one (redis-client.ts).
 *
 *   node scripts/demo/redis-latency-math.mjs   (needs upstash-shim on SHIM_URL)
 */
import { Redis } from "@upstash/redis";

const SHIM = process.env.SHIM_URL ?? "http://127.0.0.1:8079";
const TOKEN = process.env.SHIM_TOKEN ?? "dev";
const CAP_MS = 15_000;

const predicted = [0, 1, 2, 3, 4].reduce((s, i) => s + Math.exp(i) * 50, 0);

const oldClient = () => new Redis({ url: SHIM, token: TOKEN });
const newClient = () =>
  new Redis({
    url: SHIM,
    token: TOKEN,
    retry: { retries: 1, backoff: () => 50 },
    signal: () => AbortSignal.timeout(800),
  });

async function chaos(mode) {
  await fetch(`${SHIM}/__chaos/${mode}`, { method: "POST" });
}

/** The token-auth cache path: GET, and on a miss a SET. Each failure is swallowed, as in redis.ts. */
async function authPath(client) {
  const start = performance.now();
  const op = (async () => {
    await client.get("proxy:session:x").catch(() => {});
    await client.set("proxy:session:x", "{}", { ex: 60 }).catch(() => {});
  })();
  const capped = await Promise.race([op.then(() => false), new Promise((r) => setTimeout(() => r(true), CAP_MS))]);
  const ms = performance.now() - start;
  return capped ? `> ${CAP_MS / 1000}s (still hanging — no timeout at all)` : `${(ms / 1000).toFixed(2)}s`;
}

console.log(`Predicted backoff per command (old client): ${predicted.toFixed(0)}ms → x2 commands = ${(2 * predicted / 1000).toFixed(2)}s\n`);

for (const mode of ["refuse", "blackhole"]) {
  await chaos(mode);
  const label = mode === "refuse" ? "Redis refusing connections (deleted/archived DB)" : "Redis hanging (network partition)";
  console.log(label);
  console.log(`  old client (5 retries, exp backoff, no timeout): ${await authPath(oldClient())}`);
  console.log(`  new client (1 retry, 800ms timeout)            : ${await authPath(newClient())}`);
  console.log(`  new client + open circuit (next 30s)           : 0.00s — Redis skipped entirely\n`);
}
await chaos("ok");
process.exit(0);
