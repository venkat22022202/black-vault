import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "@/server/trpc/trpc";
import { db } from "@/server/db";
import { agents, agentVotes } from "@/server/db/schema";
import { eq, and, ilike, or, sql, desc, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { logActivity } from "@/server/services/activity";
import { checkRateLimit } from "@/server/services/ratelimit";
import { invalidatePublicStats } from "@/server/services/redis";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const agentsRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          category: z.string().optional(),
          sort: z.enum(["trending", "newest", "top-rated"]).default("trending"),
          limit: z.number().min(1).max(50).default(20),
          offset: z.number().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const { search, category, sort = "trending", limit = 20, offset = 0 } = input ?? {};

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

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const orderBy =
        sort === "newest"
          ? [desc(agents.createdAt)]
          : sort === "top-rated"
            ? [desc(agents.trustScore), desc(agents.totalReviews)]
            : [desc(agents.isFeatured), desc(agents.totalUpvotes)];

      const results = await db
        .select()
        .from(agents)
        .where(where)
        .orderBy(...orderBy)
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
          pitch: a.pitch,
          capabilities: (a.capabilities as string[]) ?? [],
          howItWorks: a.howItWorks,
          status: a.status,
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
          createdAt: a.createdAt,
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
        capabilities: (agent.capabilities as string[]) ?? [],
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

  submit: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(100),
        pitch: z.string().min(10).max(500),
        description: z.string().min(10).max(500),
        longDescription: z.string().max(5000).optional(),
        capabilities: z.array(z.string().max(200)).max(10).default([]),
        howItWorks: z.string().max(3000).optional(),
        category: z.string().min(1),
        provider: z.string().min(1),
        websiteUrl: z.string().url().optional().or(z.literal("")),
        githubUrl: z.string().url().optional().or(z.literal("")),
        avgCostPerRun: z.string().optional(),
        permissionsRequired: z.array(z.string()).default([]),
        tags: z.array(z.string()).max(10).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await checkRateLimit("agentSubmit", ctx.dbUserId);

      const slug = slugify(input.name);

      // Check slug uniqueness
      const [existing] = await db
        .select({ id: agents.id })
        .from(agents)
        .where(eq(agents.slug, slug))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An agent with a similar name already exists",
        });
      }

      const [agent] = await db
        .insert(agents)
        .values({
          submittedBy: ctx.dbUserId,
          name: input.name,
          slug,
          pitch: input.pitch,
          description: input.description,
          longDescription: input.longDescription ?? null,
          capabilities: input.capabilities,
          howItWorks: input.howItWorks ?? null,
          category: input.category,
          provider: input.provider,
          websiteUrl: input.websiteUrl || null,
          githubUrl: input.githubUrl || null,
          avgCostPerRun: input.avgCostPerRun ?? null,
          permissionsRequired: input.permissionsRequired,
          tags: input.tags,
          status: "approved", // Auto-approve for MVP
        })
        .returning();

      logActivity(
        ctx.dbUserId,
        "agent_submitted",
        `Submitted agent: ${input.name}`,
        `New agent "${input.name}" added to the registry`,
        { agentId: agent.id, category: input.category }
      );

      invalidatePublicStats().catch(() => {});

      return agent;
    }),

  upvote: protectedProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
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
