import { getSessionCookie } from "better-auth/cookies";
import { appUrl } from "@/lib/app-url";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Optimistic redirect only — it checks that a session cookie exists.
 * Real authorization happens in the data-access layer (requireUser).
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/sign-in", appUrl());
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*", "/profile/:path*", "/sessions/:path*", "/submissions/:path*", "/import/:path*", "/export/:path*",
    "/organize/:path*", "/events/:slug/submit", "/sponsor/:path*", "/invitations/:path*", "/welcome", "/onboarding", "/account", "/admin/:path*",
  ],
};
