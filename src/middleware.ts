import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/vault(.*)",
  "/billing(.*)",
  "/settings(.*)",
  "/activity(.*)",
  "/workflows(.*)",
]);

const isProxyRoute = (req: NextRequest) =>
  req.nextUrl.pathname.startsWith("/api/proxy/");

export default clerkMiddleware(async (auth, req) => {
  // Skip Clerk auth for proxy routes — they use their own bvt_ token auth
  if (isProxyRoute(req)) {
    return NextResponse.next();
  }
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
