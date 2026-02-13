import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function syncUser() {
  const { userId } = await auth();
  if (!userId) return null;

  // Check if user exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (existing[0]) return existing[0].id;

  // Create user from Clerk data
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

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

  return newUser?.id ?? null;
}
