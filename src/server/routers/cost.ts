import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { db } from "@/server/db";
import { proxyLogs, proxySessions } from "@/server/db/schema";
import { eq, and, sql, gte } from "drizzle-orm";
import { cached } from "@/server/services/redis";

function daysAgoDate(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const costRouter = router({
  getDailySummary: protectedProcedure.query(async ({ ctx }) => {
    return cached(`cost:daily:${ctx.dbUserId}`, 120, async () => {
      const todayStart = daysAgoDate(0);
      const yesterdayStart = daysAgoDate(1);

      const [todayResult] = await db
        .select({
          total: sql<number>`coalesce(sum(${proxyLogs.estimatedCost}::numeric), 0)`,
        })
        .from(proxyLogs)
        .where(
          and(
            eq(proxyLogs.userId, ctx.dbUserId),
            gte(proxyLogs.createdAt, todayStart)
          )
        );

      const [yesterdayResult] = await db
        .select({
          total: sql<number>`coalesce(sum(${proxyLogs.estimatedCost}::numeric), 0)`,
        })
        .from(proxyLogs)
        .where(
          and(
            eq(proxyLogs.userId, ctx.dbUserId),
            gte(proxyLogs.createdAt, yesterdayStart),
            sql`${proxyLogs.createdAt} < ${todayStart}`
          )
        );

      const todayTotal = Number(todayResult?.total ?? 0);
      const yesterdayTotal = Number(yesterdayResult?.total ?? 0);
      const changePercent =
        yesterdayTotal > 0
          ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100
          : 0;

      return {
        today: todayTotal,
        yesterday: yesterdayTotal,
        changePercent: Number(changePercent.toFixed(1)),
      };
    });
  }),

  getWeeklySummary: protectedProcedure.query(async ({ ctx }) => {
    return cached(`cost:weekly:${ctx.dbUserId}`, 120, async () => {
      const weekAgo = daysAgoDate(7);
      const [result] = await db
        .select({
          total: sql<number>`coalesce(sum(${proxyLogs.estimatedCost}::numeric), 0)`,
        })
        .from(proxyLogs)
        .where(
          and(
            eq(proxyLogs.userId, ctx.dbUserId),
            gte(proxyLogs.createdAt, weekAgo)
          )
        );

      return { total: Number(result?.total ?? 0) };
    });
  }),

  getMonthlySummary: protectedProcedure.query(async ({ ctx }) => {
    return cached(`cost:monthly:${ctx.dbUserId}`, 120, async () => {
      const monthAgo = daysAgoDate(30);
      const [result] = await db
        .select({
          total: sql<number>`coalesce(sum(${proxyLogs.estimatedCost}::numeric), 0)`,
        })
        .from(proxyLogs)
        .where(
          and(
            eq(proxyLogs.userId, ctx.dbUserId),
            gte(proxyLogs.createdAt, monthAgo)
          )
        );

      return { total: Number(result?.total ?? 0) };
    });
  }),

  getByProvider: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 30;

      return cached(`cost:provider:${ctx.dbUserId}:${days}`, 120, async () => {
        const since = daysAgoDate(days);
        const results = await db
          .select({
            provider: proxyLogs.provider,
            total: sql<number>`coalesce(sum(${proxyLogs.estimatedCost}::numeric), 0)`,
            tokens: sql<number>`coalesce(sum(${proxyLogs.totalTokens}), 0)`,
            requests: sql<number>`count(*)`,
          })
          .from(proxyLogs)
          .where(
            and(
              eq(proxyLogs.userId, ctx.dbUserId),
              gte(proxyLogs.createdAt, since)
            )
          )
          .groupBy(proxyLogs.provider);

        const grandTotal = results.reduce((acc, r) => acc + Number(r.total), 0);

        return results.map((r) => ({
          provider: r.provider,
          total: Number(Number(r.total).toFixed(2)),
          tokens: Number(r.tokens),
          requests: Number(r.requests),
          percentage: grandTotal > 0 ? Number(((Number(r.total) / grandTotal) * 100).toFixed(1)) : 0,
        }));
      });
    }),

  getLastSynced: protectedProcedure.query(async ({ ctx }) => {
    const [latest] = await db
      .select({ createdAt: proxyLogs.createdAt })
      .from(proxyLogs)
      .where(eq(proxyLogs.userId, ctx.dbUserId))
      .orderBy(sql`${proxyLogs.createdAt} desc`)
      .limit(1);

    return { lastSynced: latest?.createdAt ?? null };
  }),
});
