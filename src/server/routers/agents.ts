import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "@/server/trpc/trpc";
import { db } from "@/server/db";
import { agents, agentVotes } from "@/server/db/schema";
import { eq, and, ilike, or, sql, desc } from "drizzle-orm";

export const agentsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        category: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const { search, category, limit = 20, offset = 0 } = input ?? {};

      const conditions = [];

      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        conditions.push(
          or(
            ilike(agents.name, term),
            ilike(agents.description, term),
            ilike(agents.provider, term)
          )
        );
      }

      if (category && category !== "All") {
        conditions.push(eq(agents.category, category));
      }

      const where = conditions.length > 0
        ? and(...conditions)
        : undefined;

      const results = await db
        .select()
        .from(agents)
        .where(where)
        .orderBy(desc(agents.isFeatured), desc(agents.totalUpvotes))
        .limit(limit)
        .offset(offset);

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(agents)
        .where(where);

      return {
        agents: results.map((a) => ({
          id: a.id,
          name: a.name,
          slug: a.slug,
          description: a.description,
          category: a.category,
          provider: a.provider,
          websiteUrl: a.websiteUrl,
          githubUrl: a.githubUrl,
          avgCostPerRun: a.avgCostPerRun ? Number(a.avgCostPerRun) : null,
          permissionsRequired: (a.permissionsRequired as string[]) ?? [],
          trustScore: a.trustScore ? Number(a.trustScore) : 0,
          totalReviews: a.totalReviews,
          totalUpvotes: a.totalUpvotes,
          isVerified: a.isVerified,
          isFeatured: a.isFeatured,
          tags: a.tags ?? [],
        })),
        total: Number(countResult?.count ?? 0),
      };
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.slug, input.slug))
        .limit(1);

      if (!agent) return null;

      return {
        ...agent,
        avgCostPerRun: agent.avgCostPerRun ? Number(agent.avgCostPerRun) : null,
        trustScore: agent.trustScore ? Number(agent.trustScore) : 0,
        permissionsRequired: (agent.permissionsRequired as string[]) ?? [],
        tags: agent.tags ?? [],
      };
    }),

  getCategories: publicProcedure.query(async () => {
    const results = await db
      .select({
        category: agents.category,
        count: sql<number>`count(*)`,
      })
      .from(agents)
      .groupBy(agents.category)
      .orderBy(desc(sql<number>`count(*)`));

    return results
      .filter((r) => r.category)
      .map((r) => ({ name: r.category!, count: Number(r.count) }));
  }),

  upvote: protectedProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check if already voted
      const [existing] = await db
        .select()
        .from(agentVotes)
        .where(
          and(
            eq(agentVotes.userId, ctx.dbUserId),
            eq(agentVotes.agentId, input.agentId)
          )
        )
        .limit(1);

      if (existing) {
        // Remove vote
        await db
          .delete(agentVotes)
          .where(
            and(
              eq(agentVotes.userId, ctx.dbUserId),
              eq(agentVotes.agentId, input.agentId)
            )
          );
        await db
          .update(agents)
          .set({ totalUpvotes: sql`${agents.totalUpvotes} - 1` })
          .where(eq(agents.id, input.agentId));
        return { voted: false };
      }

      // Add vote
      await db.insert(agentVotes).values({
        userId: ctx.dbUserId,
        agentId: input.agentId,
        vote: 1,
      });
      await db
        .update(agents)
        .set({ totalUpvotes: sql`${agents.totalUpvotes} + 1` })
        .where(eq(agents.id, input.agentId));
      return { voted: true };
    }),

  myVotes: protectedProcedure.query(async ({ ctx }) => {
    const votes = await db
      .select({ agentId: agentVotes.agentId })
      .from(agentVotes)
      .where(eq(agentVotes.userId, ctx.dbUserId));
    return votes.map((v) => v.agentId);
  }),
});
