import { initTRPC, TRPCError } from "@trpc/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";

export interface Context {
  userId: string | null;
  dbUserId: string | null;
}

export async function createContext(): Promise<Context> {
  const { userId } = await auth();

  let dbUserId: string | null = null;
  if (userId) {
    // Try to find existing user in our DB
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (existing[0]) {
      dbUserId = existing[0].id;
    } else {
      // Auto-sync: create user in our DB on first access
      const clerkUser = await currentUser();
      if (clerkUser) {
        const username =
          clerkUser.username ??
          clerkUser.emailAddresses[0]?.emailAddress?.split("@")[0] ??
          `user-${userId.slice(-8)}`;

        const [newUser] = await db
          .insert(users)
          .values({
            clerkId: userId,
            username,
            displayName:
              [clerkUser.firstName, clerkUser.lastName]
                .filter(Boolean)
                .join(" ") || username,
            avatarUrl: clerkUser.imageUrl,
          })
          .onConflictDoNothing()
          .returning({ id: users.id });

        dbUserId = newUser?.id ?? null;

        // If onConflictDoNothing hit (race condition), fetch again
        if (!dbUserId) {
          const retry = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.clerkId, userId))
            .limit(1);
          dbUserId = retry[0]?.id ?? null;
        }
      }
    }
  }

  return { userId, dbUserId };
}

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId || !ctx.dbUserId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action",
    });
  }
  return next({
    ctx: {
      userId: ctx.userId,
      dbUserId: ctx.dbUserId,
    },
  });
});
