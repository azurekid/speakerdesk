import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, getPrimaryRole } from "@/lib/dal";

const HOME = { SPEAKER: "/dashboard", ORGANIZER: "/organize", SPONSOR: "/sponsor" } as const;

/** Which side of the app a destination belongs to (null = neutral, keep the current view). */
function roleFor(path: string) {
  if (path.startsWith("/organize") || path.startsWith("/invite/")) return "ORGANIZER" as const;
  if (path.startsWith("/sponsor")) return "SPONSOR" as const;
  if (/^\/(dashboard|profile|sessions|submissions|invitations|events\/[^/]+\/submit)/.test(path)) return "SPEAKER" as const;
  return null;
}

/**
 * Single post-login router. With a destination, go there (and switch the view to match).
 * Without one: new accounts pick what they came for on /welcome, returning users go home.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/sign-in", url));

  const raw = url.searchParams.get("next") ?? "";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
  if (next) {
    const role = roleFor(next);
    if (role) await prisma.user.update({ where: { id: user.id }, data: { primaryRole: role } });
    return NextResponse.redirect(new URL(next, url));
  }
  const status = await prisma.user.findUnique({ where: { id: user.id }, select: { onboardedAt: true, termsAcceptedAt: true } });
  if (url.searchParams.get("new") === "1" || (!status?.onboardedAt && !status?.termsAcceptedAt)) {
    return NextResponse.redirect(new URL("/onboarding", url));
  }
  return NextResponse.redirect(new URL(HOME[await getPrimaryRole(user.id)], url));
}
