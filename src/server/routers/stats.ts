import { router, publicProcedure } from "@/server/trpc/trpc";
import { db } from "@/server/db";
import { users, vaultKeys, agents, workflows } from "@/server/db/schema";
import { sql } from "drizzle-orm";
import { cached } from "@/server/services/redis";

export const statsRouter = router({
  getPublicStats: publicProcedure.query(async () => {
    return cached("stats:public", 60, async () => {
      const [[userCount], [keyCount], [agentCount], [workflowCount]] =
        await Promise.all([
          db.select({ count: sql<number>`count(*)` }).from(users),
          db.select({ count: sql<number>`count(*)` }).from(vaultKeys),
          db.select({ count: sql<number>`count(*)` }).from(agents),
          db.select({ count: sql<number>`count(*)` }).from(workflows),
        ]);

      return {
        users: Number(userCount?.count ?? 0),
        keys: Number(keyCount?.count ?? 0),
        agents: Number(agentCount?.count ?? 0),
        workflows: Number(workflowCount?.count ?? 0),
      };
    });
  }),
});
