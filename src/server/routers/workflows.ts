import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "@/server/trpc/trpc";
import { db } from "@/server/db";
import { workflows, workflowStars, users } from "@/server/db/schema";
import { eq, and, ilike, or, sql, desc, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { logActivity } from "@/server/services/activity";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const workflowsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        sort: z.enum(["popular", "newest", "most-forked"]).default("popular"),
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const { search, sort = "popular", limit = 20, offset = 0 } = input ?? {};

      const conditions = [eq(workflows.isPublic, true)];

      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        conditions.push(
          or(
            ilike(workflows.name, term),
            ilike(workflows.description, term)
          )!
        );
      }

      const where = and(...conditions);

      const orderBy =
        sort === "newest"
          ? [desc(workflows.createdAt)]
          : sort === "most-forked"
            ? [desc(workflows.totalForks)]
            : [desc(workflows.totalStars), desc(workflows.totalForks)];

      const results = await db
        .select({
          id: workflows.id,
          name: workflows.name,
          slug: workflows.slug,
          description: workflows.description,
          providersUsed: workflows.providersUsed,
          totalForks: workflows.totalForks,
          totalStars: workflows.totalStars,
          tags: workflows.tags,
          createdAt: workflows.createdAt,
          authorId: workflows.authorId,
          authorName: users.displayName,
          authorAvatar: users.avatarUrl,
          authorUsername: users.username,
        })
        .from(workflows)
        .leftJoin(users, eq(workflows.authorId, users.id))
        .where(where)
        .orderBy(...orderBy)
        .limit(limit)
        .offset(offset);

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(workflows)
        .where(where);

      return {
        workflows: results.map((w) => ({
          id: w.id,
          name: w.name,
          slug: w.slug,
          description: w.description,
          providersUsed: w.providersUsed ?? [],
          totalForks: w.totalForks,
          totalStars: w.totalStars,
          tags: w.tags ?? [],
          createdAt: w.createdAt,
          author: {
            id: w.authorId,
            displayName: w.authorName ?? w.authorUsername ?? "Anonymous",
            avatarUrl: w.authorAvatar,
          },
        })),
        total: Number(countResult?.count ?? 0),
      };
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const [result] = await db
        .select({
          id: workflows.id,
          name: workflows.name,
          slug: workflows.slug,
          description: workflows.description,
          config: workflows.config,
          agentsUsed: workflows.agentsUsed,
          providersUsed: workflows.providersUsed,
          estimatedCost: workflows.estimatedCost,
          totalForks: workflows.totalForks,
          totalStars: workflows.totalStars,
          isPublic: workflows.isPublic,
          version: workflows.version,
          tags: workflows.tags,
          createdAt: workflows.createdAt,
          updatedAt: workflows.updatedAt,
          authorId: workflows.authorId,
          authorName: users.displayName,
          authorAvatar: users.avatarUrl,
          authorUsername: users.username,
        })
        .from(workflows)
        .leftJoin(users, eq(workflows.authorId, users.id))
        .where(eq(workflows.slug, input.slug))
        .limit(1);

      if (!result) return null;

      return {
        ...result,
        estimatedCost: result.estimatedCost ? Number(result.estimatedCost) : null,
        providersUsed: result.providersUsed ?? [],
        tags: result.tags ?? [],
        author: {
          id: result.authorId,
          displayName: result.authorName ?? result.authorUsername ?? "Anonymous",
          avatarUrl: result.authorAvatar,
        },
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(100),
        description: z.string().max(1000).optional(),
        config: z.record(z.string(), z.unknown()),
        providersUsed: z.array(z.string()).default([]),
        tags: z.array(z.string()).max(10).default([]),
        isPublic: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let slug = slugify(input.name);

      // Ensure slug uniqueness
      const [existing] = await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(eq(workflows.slug, slug))
        .limit(1);

      if (existing) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }

      const [workflow] = await db
        .insert(workflows)
        .values({
          authorId: ctx.dbUserId,
          name: input.name,
          slug,
          description: input.description ?? null,
          config: input.config,
          providersUsed: input.providersUsed,
          tags: input.tags,
          isPublic: input.isPublic,
        })
        .returning();

      logActivity(
        ctx.dbUserId,
        "workflow_created",
        `Created workflow: ${input.name}`,
        `New workflow "${input.name}" published`,
        { workflowId: workflow.id, slug }
      );

      return workflow;
    }),

  fork: protectedProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [original] = await db
        .select()
        .from(workflows)
        .where(eq(workflows.id, input.workflowId))
        .limit(1);

      if (!original) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });
      }

      const slug = `${original.slug}-fork-${Date.now().toString(36)}`;

      const [forked] = await db
        .insert(workflows)
        .values({
          authorId: ctx.dbUserId,
          name: `${original.name} (fork)`,
          slug,
          description: original.description,
          config: original.config,
          agentsUsed: original.agentsUsed,
          providersUsed: original.providersUsed,
          estimatedCost: original.estimatedCost,
          tags: original.tags,
          isPublic: true,
        })
        .returning();

      // Increment fork count on original
      await db
        .update(workflows)
        .set({ totalForks: sql`${workflows.totalForks} + 1` })
        .where(eq(workflows.id, input.workflowId));

      logActivity(
        ctx.dbUserId,
        "workflow_forked",
        `Forked workflow: ${original.name}`,
        `Forked "${original.name}" → "${forked.name}"`,
        { originalId: input.workflowId, forkedId: forked.id }
      );

      return forked;
    }),

  star: protectedProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check existing star
      const [existing] = await db
        .select()
        .from(workflowStars)
        .where(
          and(
            eq(workflowStars.userId, ctx.dbUserId),
            eq(workflowStars.workflowId, input.workflowId)
          )
        )
        .limit(1);

      if (existing) {
        // Unstar
        await db
          .delete(workflowStars)
          .where(
            and(
              eq(workflowStars.userId, ctx.dbUserId),
              eq(workflowStars.workflowId, input.workflowId)
            )
          );
        await db
          .update(workflows)
          .set({ totalStars: sql`${workflows.totalStars} - 1` })
          .where(eq(workflows.id, input.workflowId));
        return { starred: false };
      }

      // Star
      await db.insert(workflowStars).values({
        userId: ctx.dbUserId,
        workflowId: input.workflowId,
      });
      await db
        .update(workflows)
        .set({ totalStars: sql`${workflows.totalStars} + 1` })
        .where(eq(workflows.id, input.workflowId));

      logActivity(
        ctx.dbUserId,
        "workflow_starred",
        "Starred a workflow",
        undefined,
        { workflowId: input.workflowId }
      );

      return { starred: true };
    }),

  myStars: protectedProcedure.query(async ({ ctx }) => {
    const stars = await db
      .select({ workflowId: workflowStars.workflowId })
      .from(workflowStars)
      .where(eq(workflowStars.userId, ctx.dbUserId));
    return stars.map((s) => s.workflowId);
  }),

  myWorkflows: protectedProcedure.query(async ({ ctx }) => {
    const results = await db
      .select()
      .from(workflows)
      .where(eq(workflows.authorId, ctx.dbUserId))
      .orderBy(desc(workflows.createdAt));

    return results.map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      description: w.description,
      totalForks: w.totalForks,
      totalStars: w.totalStars,
      providersUsed: w.providersUsed ?? [],
      tags: w.tags ?? [],
      isPublic: w.isPublic,
      createdAt: w.createdAt,
    }));
  }),
});
