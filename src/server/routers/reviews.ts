import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "@/server/trpc/trpc";
import { db } from "@/server/db";
import { reviews, agents, users } from "@/server/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { logActivity } from "@/server/services/activity";

export const reviewsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        agentId: z.string().uuid(),
        sort: z.enum(["newest", "oldest", "highest", "lowest"]).default("newest"),
        limit: z.number().min(1).max(50).default(10),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const { agentId, sort, limit, offset } = input;

      const orderBy =
        sort === "newest"
          ? desc(reviews.createdAt)
          : sort === "oldest"
            ? asc(reviews.createdAt)
            : sort === "highest"
              ? desc(reviews.rating)
              : asc(reviews.rating);

      const results = await db
        .select({
          id: reviews.id,
          rating: reviews.rating,
          title: reviews.title,
          body: reviews.body,
          pros: reviews.pros,
          cons: reviews.cons,
          upvotes: reviews.upvotes,
          createdAt: reviews.createdAt,
          userId: reviews.userId,
          userName: users.displayName,
          userAvatar: users.avatarUrl,
          username: users.username,
        })
        .from(reviews)
        .leftJoin(users, eq(reviews.userId, users.id))
        .where(eq(reviews.agentId, agentId))
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset);

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(reviews)
        .where(eq(reviews.agentId, agentId));

      return {
        reviews: results.map((r) => ({
          id: r.id,
          rating: r.rating,
          title: r.title,
          body: r.body,
          pros: r.pros ?? [],
          cons: r.cons ?? [],
          upvotes: r.upvotes,
          createdAt: r.createdAt,
          user: {
            id: r.userId,
            displayName: r.userName ?? r.username ?? "Anonymous",
            avatarUrl: r.userAvatar,
          },
        })),
        total: Number(countResult?.count ?? 0),
      };
    }),

  submit: protectedProcedure
    .input(
      z.object({
        agentId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        title: z.string().min(3).max(200),
        body: z.string().min(10).max(5000),
        pros: z.array(z.string().max(200)).max(5).default([]),
        cons: z.array(z.string().max(200)).max(5).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user already reviewed this agent
      const [existing] = await db
        .select({ id: reviews.id })
        .from(reviews)
        .where(
          and(
            eq(reviews.agentId, input.agentId),
            eq(reviews.userId, ctx.dbUserId)
          )
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You have already reviewed this agent",
        });
      }

      // Verify agent exists
      const [agent] = await db
        .select({ id: agents.id })
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .limit(1);

      if (!agent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent not found",
        });
      }

      // Insert review
      const [review] = await db
        .insert(reviews)
        .values({
          agentId: input.agentId,
          userId: ctx.dbUserId,
          rating: input.rating,
          title: input.title,
          body: input.body,
          pros: input.pros,
          cons: input.cons,
        })
        .returning();

      // Recalculate trust score
      const [stats] = await db
        .select({
          avgRating: sql<number>`avg(${reviews.rating})`,
          totalReviews: sql<number>`count(*)`,
        })
        .from(reviews)
        .where(eq(reviews.agentId, input.agentId));

      await db
        .update(agents)
        .set({
          trustScore: String(Number(stats.avgRating).toFixed(2)),
          totalReviews: Number(stats.totalReviews),
        })
        .where(eq(agents.id, input.agentId));

      logActivity(
        ctx.dbUserId,
        "review_submitted",
        `Reviewed an agent (${input.rating}/5)`,
        `Submitted review: "${input.title}"`,
        { agentId: input.agentId, rating: input.rating }
      );

      return review;
    }),

  myReview: protectedProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [review] = await db
        .select()
        .from(reviews)
        .where(
          and(
            eq(reviews.agentId, input.agentId),
            eq(reviews.userId, ctx.dbUserId)
          )
        )
        .limit(1);

      return review ?? null;
    }),
});
