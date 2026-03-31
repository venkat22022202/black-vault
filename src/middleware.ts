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
    // Exclude proxy routes and universal gateway — they use their own bvt_ token auth, not Clerk
    "/((?!_next|api/proxy/|api/v1/|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(trpc)(.*)",
  ],
};
