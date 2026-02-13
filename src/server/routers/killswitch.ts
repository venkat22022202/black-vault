import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { db } from "@/server/db";
import { vaultKeys } from "@/server/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logActivity } from "@/server/services/activity";

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

      await db
        .update(vaultKeys)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(vaultKeys.id, input.keyId));

      logActivity(
        ctx.dbUserId,
        "killswitch_single",
        `Revoked key: ${key.label}`,
        `Kill switch activated for ${key.provider} key "${key.label}"`,
        { keyId: input.keyId, provider: key.provider }
      );

      return { success: true };
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

    logActivity(
      ctx.dbUserId,
      "killswitch_all",
      `Kill Switch: Revoked all ${count} keys`,
      `Emergency kill switch activated — all ${count} active keys disabled`,
      { revokedCount: count }
    );

    return { success: true, revokedCount: count };
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

    return {
      total: Number(result?.total ?? 0),
      active: Number(result?.active ?? 0),
      disabled: Number(result?.disabled ?? 0),
    };
  }),
});
