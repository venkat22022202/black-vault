import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, ctx.dbUserId))
      .limit(1);

    if (!user) return null;

    return {
      id: user.id,
      clerkId: user.clerkId,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      githubUrl: user.githubUrl,
      plan: user.plan,
      createdAt: user.createdAt,
    };
  }),

  update: protectedProcedure
    .input(
      z.object({
        displayName: z.string().min(1).max(100).optional(),
        bio: z.string().max(300).optional(),
        githubUrl: z.string().url().optional().or(z.literal("")),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.displayName !== undefined) updates.displayName = input.displayName;
      if (input.bio !== undefined) updates.bio = input.bio;
      if (input.githubUrl !== undefined) updates.githubUrl = input.githubUrl || null;

      await db
        .update(users)
        .set(updates)
        .where(eq(users.id, ctx.dbUserId));

      return { success: true };
    }),
});
