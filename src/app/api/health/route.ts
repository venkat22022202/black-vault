import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { probeRedis, redisFailMode } from "@/server/services/redis-client";

export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 3000;

/**
 * Liveness + dependency health for uptime monitors.
 *
 * 200 only when every configured dependency answers. A dead Redis returns 503
 * even though the gateway keeps serving (degraded): rate limits and real-time
 * budgets are security guarantees, so losing them must page someone instead of
 * failing silently. No error details are returned — just status and latency.
 */
export async function GET() {
  const [database, redis] = await Promise.all([probeDatabase(), probeRedis()]);

  const healthy = database.status === "ok" && redis.status !== "down";
  const body = {
    status: healthy ? "ok" : database.status === "ok" ? "degraded" : "down",
    checks: { database, redis },
    redisFailMode: redisFailMode(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    time: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: healthy ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}

async function probeDatabase(): Promise<{ status: "ok" | "down"; latencyMs: number }> {
  const start = Date.now();
  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), DB_TIMEOUT_MS)),
    ]);
    return { status: "ok", latencyMs: Date.now() - start };
  } catch {
    return { status: "down", latencyMs: Date.now() - start };
  }
}
