import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { db } from "@/server/db";
import { providerCostSnapshots } from "@/server/db/schema";
import { eq, and, sql, gte, desc } from "drizzle-orm";
import { cached } from "@/server/services/redis";
import { syncCostsForUser } from "@/server/services/cost-sync";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export const costRouter = router({
  getDailySummary: protectedProcedure.query(async ({ ctx }) => {
    // Lazily ensure cost data exists
    await syncCostsForUser(ctx.dbUserId);

    return cached(`cost:daily:${ctx.dbUserId}`, 300, async () => {
      const today = daysAgo(0);
      const yesterday = daysAgo(1);

      const [todayResult] = await db
        .select({
          total: sql<number>`coalesce(sum(${providerCostSnapshots.dailyCost}::numeric), 0)`,
        })
        .from(providerCostSnapshots)
        .where(
          and(
            eq(providerCostSnapshots.userId, ctx.dbUserId),
            eq(providerCostSnapshots.date, today)
          )
        );

      const [yesterdayResult] = await db
        .select({
          total: sql<number>`coalesce(sum(${providerCostSnapshots.dailyCost}::numeric), 0)`,
        })
        .from(providerCostSnapshots)
        .where(
          and(
            eq(providerCostSnapshots.userId, ctx.dbUserId),
            eq(providerCostSnapshots.date, yesterday)
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
    await syncCostsForUser(ctx.dbUserId);

    return cached(`cost:weekly:${ctx.dbUserId}`, 300, async () => {
      const weekAgo = daysAgo(7);
      const [result] = await db
        .select({
          total: sql<number>`coalesce(sum(${providerCostSnapshots.dailyCost}::numeric), 0)`,
        })
        .from(providerCostSnapshots)
        .where(
          and(
            eq(providerCostSnapshots.userId, ctx.dbUserId),
            gte(providerCostSnapshots.date, weekAgo)
          )
        );

      return { total: Number(result?.total ?? 0) };
    });
  }),

  getMonthlySummary: protectedProcedure.query(async ({ ctx }) => {
    await syncCostsForUser(ctx.dbUserId);

    return cached(`cost:monthly:${ctx.dbUserId}`, 300, async () => {
      const monthAgo = daysAgo(30);
      const [result] = await db
        .select({
          total: sql<number>`coalesce(sum(${providerCostSnapshots.dailyCost}::numeric), 0)`,
        })
        .from(providerCostSnapshots)
        .where(
          and(
            eq(providerCostSnapshots.userId, ctx.dbUserId),
            gte(providerCostSnapshots.date, monthAgo)
          )
        );

      return { total: Number(result?.total ?? 0) };
    });
  }),

  getByProvider: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      await syncCostsForUser(ctx.dbUserId);
      const days = input?.days ?? 30;

      return cached(`cost:provider:${ctx.dbUserId}:${days}`, 300, async () => {
        const since = daysAgo(days);
        const results = await db
          .select({
            provider: providerCostSnapshots.provider,
            total: sql<number>`coalesce(sum(${providerCostSnapshots.dailyCost}::numeric), 0)`,
            tokens: sql<number>`coalesce(sum(${providerCostSnapshots.tokenCount}), 0)`,
            requests: sql<number>`coalesce(sum(${providerCostSnapshots.requestCount}), 0)`,
          })
          .from(providerCostSnapshots)
          .where(
            and(
              eq(providerCostSnapshots.userId, ctx.dbUserId),
              gte(providerCostSnapshots.date, since)
            )
          )
          .groupBy(providerCostSnapshots.provider);

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
      .select({ createdAt: providerCostSnapshots.createdAt })
      .from(providerCostSnapshots)
      .where(eq(providerCostSnapshots.userId, ctx.dbUserId))
      .orderBy(desc(providerCostSnapshots.createdAt))
      .limit(1);

    return { lastSynced: latest?.createdAt ?? null };
  }),
});
