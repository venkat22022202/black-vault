import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { db } from "@/server/db";
import { activityLog } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";

export const activityRouter = router({
  getRecent: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(5) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 5;
      const items = await db
        .select()
        .from(activityLog)
        .where(eq(activityLog.userId, ctx.dbUserId))
        .orderBy(desc(activityLog.createdAt))
        .limit(limit);

      return items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        description: item.description,
        metadata: item.metadata,
        createdAt: item.createdAt,
      }));
    }),

  getAll: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;

      const items = await db
        .select()
        .from(activityLog)
        .where(eq(activityLog.userId, ctx.dbUserId))
        .orderBy(desc(activityLog.createdAt))
        .limit(limit)
        .offset(offset);

      return items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        description: item.description,
        metadata: item.metadata,
        createdAt: item.createdAt,
      }));
    }),

  getByType: protectedProcedure
    .input(
      z.object({
        type: z.string(),
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const { type, limit, offset } = input;

      // Filter by prefix (e.g., "key" matches key_created, key_revealed, etc.)
      const items = await db
        .select()
        .from(activityLog)
        .where(eq(activityLog.userId, ctx.dbUserId))
        .orderBy(desc(activityLog.createdAt))
        .limit(limit)
        .offset(offset);

      const filtered = type === "all"
        ? items
        : items.filter((item) => item.type.startsWith(type));

      return filtered.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        description: item.description,
        metadata: item.metadata,
        createdAt: item.createdAt,
      }));
    }),
});
