import { db } from "@/server/db";
import { providerCostSnapshots, vaultKeys, users } from "@/server/db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * For MVP: generates simulated cost data per active vault key provider.
 * Real provider billing API integration can replace this later.
 */
export async function syncCostsForUser(userId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Check if we already have data for today
  const [existing] = await db
    .select({ id: providerCostSnapshots.id })
    .from(providerCostSnapshots)
    .where(
      and(
        eq(providerCostSnapshots.userId, userId),
        eq(providerCostSnapshots.date, today)
      )
    )
    .limit(1);

  if (existing) return; // Already synced today

  // Get distinct active providers for this user
  const activeKeys = await db
    .select({ provider: vaultKeys.provider })
    .from(vaultKeys)
    .where(and(eq(vaultKeys.userId, userId), eq(vaultKeys.isActive, true)));

  const providers = [...new Set(activeKeys.map((k) => k.provider))];

  if (providers.length === 0) return;

  // Get yesterday's cumulative costs for each provider
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const yesterdaySnapshots = await db
    .select({
      provider: providerCostSnapshots.provider,
      cumulativeCost: providerCostSnapshots.cumulativeCost,
    })
    .from(providerCostSnapshots)
    .where(
      and(
        eq(providerCostSnapshots.userId, userId),
        eq(providerCostSnapshots.date, yesterdayStr)
      )
    );

  const yesterdayMap = new Map(
    yesterdaySnapshots.map((s) => [s.provider, Number(s.cumulativeCost)])
  );

  // Generate simulated data for each provider
  const snapshots = providers.map((provider) => {
    const dailyCost = Number((Math.random() * 2.49 + 0.01).toFixed(4));
    const prevCumulative = yesterdayMap.get(provider) ?? 0;
    const tokenCount = Math.floor(Math.random() * 50000) + 500;
    const requestCount = Math.floor(Math.random() * 200) + 5;

    return {
      userId,
      provider,
      date: today,
      dailyCost: dailyCost.toString(),
      cumulativeCost: (prevCumulative + dailyCost).toFixed(4),
      tokenCount,
      requestCount,
    };
  });

  if (snapshots.length > 0) {
    await db.insert(providerCostSnapshots).values(snapshots);
  }
}

/**
 * Sync costs for all users — called by cron job
 */
export async function syncAllUserCosts(): Promise<{ synced: number }> {
  const allUsers = await db
    .select({ id: users.id })
    .from(users);

  let synced = 0;
  for (const user of allUsers) {
    try {
      await syncCostsForUser(user.id);
      synced++;
    } catch {
      // Continue with other users
    }
  }

  return { synced };
}
