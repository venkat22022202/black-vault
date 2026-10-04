import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/vault(.*)",
  "/billing(.*)",
  "/settings(.*)",
  "/activity(.*)",
  "/workflows(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Exclude proxy, universal gateway, MCP and egress routes — they use their own bvt_ token auth, not Clerk.
    // /api/health is public so uptime monitors can reach it.
    "/((?!_next|api/proxy/|api/v1/|api/mcp/|api/egress/|api/health|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(trpc)(.*)",
  ],
};
