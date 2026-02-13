import { router } from "./trpc";
import { vaultRouter } from "@/server/routers/vault";
import { agentsRouter } from "@/server/routers/agents";
import { userRouter } from "@/server/routers/user";

export const appRouter = router({
  vault: vaultRouter,
  agents: agentsRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
