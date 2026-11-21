import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { SITE_URL } from "@/lib/site";

/** Signed-in areas: without a session cookie, send people to sign in first. */
const PROTECTED = [
  /^\/(dashboard|profile|sessions|submissions|import|export|organize|sponsor|invitations|admin)(\/|$)/,
  /^\/events\/[^/]+\/submit$/,
  /^\/(welcome|onboarding|account|badges)$/,
  /^\/scan(\/|$)/, // the door scanner: sign in on the door phone first
];

const canonicalHost = new URL(SITE_URL).host;

/**
 * Aliases of the public site (www., and the Azure Container Apps default address) that search
 * engines must not index as separate copies: they get a permanent redirect to the canonical domain.
 * Only when the canonical domain is actually the site's URL, so local and test setups are untouched.
 */
function isAliasHost(host: string) {
  if (!host || host === canonicalHost || appUrl() !== SITE_URL) return false;
  return host === `www.${canonicalHost}` || host.endsWith(".azurecontainerapps.io");
}

/**
 * 1. Canonical host redirect (SEO).
 * 2. Optimistic sign-in redirect: it only checks that a session cookie exists.
 *    Real authorization happens in the data-access layer (requireUser).
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (isAliasHost(host)) {
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, SITE_URL);
    return NextResponse.redirect(target, 301);
  }

  const { pathname } = request.nextUrl;
  if (PROTECTED.some((re) => re.test(pathname)) && !getSessionCookie(request)) {
    const url = new URL("/sign-in", appUrl());
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except APIs (health probes, auth callbacks), Next internals and static files.
  matcher: ["/((?!api/|_next/|images/|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)"],
};
