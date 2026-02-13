import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { db } from "@/server/db";
import { vaultKeys } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { encryptApiKey, decryptApiKey } from "@/server/services/encryption";
import { maskApiKey } from "@/lib/utils";
import { randomUUID } from "crypto";

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
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(vaultKeys)
        .where(
          and(
            eq(vaultKeys.id, input.id),
            eq(vaultKeys.userId, ctx.dbUserId)
          )
        );
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

      return { isActive: !key.isActive };
    }),
});
