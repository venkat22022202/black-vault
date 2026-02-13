import { router } from "./trpc";
import { vaultRouter } from "@/server/routers/vault";
import { agentsRouter } from "@/server/routers/agents";
import { userRouter } from "@/server/routers/user";
import { reviewsRouter } from "@/server/routers/reviews";
import { activityRouter } from "@/server/routers/activity";
import { costRouter } from "@/server/routers/cost";
import { killswitchRouter } from "@/server/routers/killswitch";
import { workflowsRouter } from "@/server/routers/workflows";
import { statsRouter } from "@/server/routers/stats";
import { proxyRouter } from "@/server/routers/proxy";

export const appRouter = router({
  vault: vaultRouter,
  agents: agentsRouter,
  user: userRouter,
  reviews: reviewsRouter,
  activity: activityRouter,
  cost: costRouter,
  killswitch: killswitchRouter,
  workflows: workflowsRouter,
  stats: statsRouter,
  proxy: proxyRouter,
});

export type AppRouter = typeof appRouter;
