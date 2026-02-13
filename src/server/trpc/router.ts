import { router } from "./trpc";
import { vaultRouter } from "@/server/routers/vault";
import { agentsRouter } from "@/server/routers/agents";
import { userRouter } from "@/server/routers/user";
import { reviewsRouter } from "@/server/routers/reviews";

export const appRouter = router({
  vault: vaultRouter,
  agents: agentsRouter,
  user: userRouter,
  reviews: reviewsRouter,
});

export type AppRouter = typeof appRouter;
