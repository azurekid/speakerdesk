import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";

/**
 * Switches the signed-in user's primary view (speaker / organizer) and continues to `next`.
 * Used right after sign-in from the speaker or organizer login, and by the "switch view" link.
 * It only changes a UI preference of the caller, never grants access.
 */
const HOME = { SPEAKER: "/dashboard", ORGANIZER: "/organize", SPONSOR: "/sponsor" } as const;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const param = url.searchParams.get("role");
  const role = param === "organizer" ? "ORGANIZER" : param === "sponsor" ? "SPONSOR" : "SPEAKER";
  const rawNext = url.searchParams.get("next") ?? "";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : HOME[role];

  const user = await getCurrentUser();
  if (!user) {
    const signIn = new URL("/sign-in", url);
    signIn.searchParams.set("next", next);
    return NextResponse.redirect(signIn);
  }
  await prisma.user.update({ where: { id: user.id }, data: { primaryRole: role } });
  return NextResponse.redirect(new URL(next, url));
}
