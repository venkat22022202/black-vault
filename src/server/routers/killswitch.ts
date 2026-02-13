import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { db } from "@/server/db";
import { vaultKeys, proxySessions } from "@/server/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logActivity } from "@/server/services/activity";
import { invalidateProxySessionsForKey } from "@/server/services/proxy-auth";

export const killswitchRouter = router({
  revokeKey: protectedProcedure
    .input(z.object({ keyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [key] = await db
        .select({ id: vaultKeys.id, label: vaultKeys.label, provider: vaultKeys.provider })
        .from(vaultKeys)
        .where(
          and(
            eq(vaultKeys.id, input.keyId),
            eq(vaultKeys.userId, ctx.dbUserId)
          )
        )
        .limit(1);

      if (!key) throw new Error("Key not found");

      // Disable the vault key
      await db
        .update(vaultKeys)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(vaultKeys.id, input.keyId));

      // Cascade: kill all proxy sessions for this key
      const killedSessions = await db
        .update(proxySessions)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(proxySessions.vaultKeyId, input.keyId),
            eq(proxySessions.isActive, true)
          )
        )
        .returning({ id: proxySessions.id });

      // Invalidate Redis cache for all sessions
      await invalidateProxySessionsForKey(input.keyId);

      logActivity(
        ctx.dbUserId,
        "killswitch_single",
        `Revoked key: ${key.label}`,
        `Kill switch activated for ${key.provider} key "${key.label}" — ${killedSessions.length} proxy sessions terminated`,
        { keyId: input.keyId, provider: key.provider, sessionsKilled: killedSessions.length }
      );

      return { success: true, sessionsKilled: killedSessions.length };
    }),

  revokeAll: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await db
      .update(vaultKeys)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(vaultKeys.userId, ctx.dbUserId),
          eq(vaultKeys.isActive, true)
        )
      )
      .returning({ id: vaultKeys.id });

    const count = result.length;

    // Cascade: kill ALL proxy sessions for this user
    const killedSessions = await db
      .update(proxySessions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(proxySessions.userId, ctx.dbUserId),
          eq(proxySessions.isActive, true)
        )
      )
      .returning({ id: proxySessions.id });

    // Bulk invalidate Redis cache for all killed sessions
    const allSessions = await db
      .select({ tokenHash: proxySessions.tokenHash })
      .from(proxySessions)
      .where(eq(proxySessions.userId, ctx.dbUserId));

    const { invalidateCache } = await import("@/server/services/redis");
    await Promise.all(
      allSessions.map((s) => invalidateCache(`proxy:session:${s.tokenHash}`))
    );

    logActivity(
      ctx.dbUserId,
      "killswitch_all",
      `Kill Switch: Revoked all ${count} keys`,
      `Emergency kill switch activated — all ${count} active keys disabled, ${killedSessions.length} proxy sessions terminated`,
      { revokedCount: count, sessionsKilled: killedSessions.length }
    );

    return { success: true, revokedCount: count, sessionsKilled: killedSessions.length };
  }),

  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const [result] = await db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${vaultKeys.isActive} = true)`,
        disabled: sql<number>`count(*) filter (where ${vaultKeys.isActive} = false)`,
      })
      .from(vaultKeys)
      .where(eq(vaultKeys.userId, ctx.dbUserId));

    const [sessionResult] = await db
      .select({
        activeSessions: sql<number>`count(*) filter (where ${proxySessions.isActive} = true)`,
        totalSessions: sql<number>`count(*)`,
      })
      .from(proxySessions)
      .where(eq(proxySessions.userId, ctx.dbUserId));

    return {
      total: Number(result?.total ?? 0),
      active: Number(result?.active ?? 0),
      disabled: Number(result?.disabled ?? 0),
      activeSessions: Number(sessionResult?.activeSessions ?? 0),
      totalSessions: Number(sessionResult?.totalSessions ?? 0),
    };
  }),
});
