import { router } from "./trpc";
import { vaultRouter } from "@/server/routers/vault";

export const appRouter = router({
  vault: vaultRouter,
});

export type AppRouter = typeof appRouter;
