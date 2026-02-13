import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { db } from "@/server/db";
import { vaultKeys, proxySessions } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { encryptApiKey, decryptApiKey } from "@/server/services/encryption";
import { maskApiKey } from "@/lib/utils";
import { randomUUID } from "crypto";
import { logActivity } from "@/server/services/activity";
import { checkRateLimit } from "@/server/services/ratelimit";
import { invalidateProxySessionsForKey } from "@/server/services/proxy-auth";

export const vaultRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const keys = await db
      .select()
      .from(vaultKeys)
      .where(eq(vaultKeys.userId, ctx.dbUserId))
      .orderBy(vaultKeys.createdAt);

    return keys.map((key) => ({
      id: key.id,
      provider: key.provider,
      label: key.label,
      keyPrefix: key.keyPrefix ?? "****",
      isActive: key.isActive,
      monthlyBudget: key.monthlyBudget ? Number(key.monthlyBudget) : null,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
    }));
  }),

  create: protectedProcedure
    .input(
      z.object({
        provider: z.string().min(1),
        label: z.string().min(1).max(100),
        apiKey: z.string().min(1),
        monthlyBudget: z.number().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await checkRateLimit("vaultCreate", ctx.dbUserId);

      const keyId = randomUUID();
      const { encrypted, iv } = encryptApiKey(
        input.apiKey,
        ctx.dbUserId,
        keyId
      );
      const prefix = maskApiKey(input.apiKey);

      const [key] = await db
        .insert(vaultKeys)
        .values({
          id: keyId,
          userId: ctx.dbUserId,
          provider: input.provider,
          label: input.label,
          encryptedKey: encrypted,
          iv,
          keyPrefix: prefix,
          monthlyBudget: input.monthlyBudget?.toString(),
        })
        .returning();

      logActivity(
        ctx.dbUserId,
        "key_created",
        `Added ${input.provider} key: ${input.label}`,
        `New API key encrypted and stored`,
        { keyId: key.id, provider: input.provider }
      );

      return {
        id: key.id,
        provider: key.provider,
        label: key.label,
        keyPrefix: prefix,
      };
    }),

  reveal: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await checkRateLimit("vaultReveal", ctx.dbUserId);

      const [key] = await db
        .select()
        .from(vaultKeys)
        .where(
          and(
            eq(vaultKeys.id, input.id),
            eq(vaultKeys.userId, ctx.dbUserId)
          )
        )
        .limit(1);

      if (!key) {
        throw new Error("Key not found");
      }

      const decrypted = decryptApiKey(
        key.encryptedKey,
        key.iv,
        ctx.dbUserId,
        key.id
      );

      // Update last used
      await db
        .update(vaultKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(vaultKeys.id, input.id));

      logActivity(
        ctx.dbUserId,
        "key_revealed",
        `Revealed key: ${key.label}`,
        undefined,
        { keyId: input.id, provider: key.provider }
      );

      return { apiKey: decrypted };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        label: z.string().min(1).max(100).optional(),
        monthlyBudget: z.number().positive().nullable().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      await db
        .update(vaultKeys)
        .set({
          ...updates,
          monthlyBudget: updates.monthlyBudget?.toString(),
          updatedAt: new Date(),
        })
        .where(
          and(eq(vaultKeys.id, id), eq(vaultKeys.userId, ctx.dbUserId))
        );

      // If explicitly setting isActive to false, kill proxy sessions
      if (updates.isActive === false) {
        await db
          .update(proxySessions)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(proxySessions.vaultKeyId, id),
              eq(proxySessions.isActive, true)
            )
          );
        await invalidateProxySessionsForKey(id);
      }

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [key] = await db
        .select({ label: vaultKeys.label, provider: vaultKeys.provider })
        .from(vaultKeys)
        .where(
          and(eq(vaultKeys.id, input.id), eq(vaultKeys.userId, ctx.dbUserId))
        )
        .limit(1);

      // Invalidate proxy session cache BEFORE the FK cascade deletes the rows
      await invalidateProxySessionsForKey(input.id);

      await db
        .delete(vaultKeys)
        .where(
          and(
            eq(vaultKeys.id, input.id),
            eq(vaultKeys.userId, ctx.dbUserId)
          )
        );

      if (key) {
        logActivity(
          ctx.dbUserId,
          "key_deleted",
          `Deleted key: ${key.label}`,
          `Permanently deleted ${key.provider} key`,
          { provider: key.provider }
        );
      }

      return { success: true };
    }),

  toggleActive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [key] = await db
        .select({ isActive: vaultKeys.isActive })
        .from(vaultKeys)
        .where(
          and(
            eq(vaultKeys.id, input.id),
            eq(vaultKeys.userId, ctx.dbUserId)
          )
        )
        .limit(1);

      if (!key) throw new Error("Key not found");

      await db
        .update(vaultKeys)
        .set({ isActive: !key.isActive, updatedAt: new Date() })
        .where(eq(vaultKeys.id, input.id));

      // When disabling: kill all proxy sessions + invalidate cache
      if (key.isActive) {
        await db
          .update(proxySessions)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(proxySessions.vaultKeyId, input.id),
              eq(proxySessions.isActive, true)
            )
          );
        await invalidateProxySessionsForKey(input.id);
      }

      logActivity(
        ctx.dbUserId,
        "key_toggled",
        `${key.isActive ? "Disabled" : "Enabled"} a key`,
        undefined,
        { keyId: input.id, newState: !key.isActive }
      );

      return { isActive: !key.isActive };
    }),
});
