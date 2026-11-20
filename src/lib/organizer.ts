import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { type CurrentUser, requireUser } from "@/lib/dal";
import { atLeast, type EventRole } from "@/lib/permissions";

export type { EventRole };

/**
 * Loads an event the signed-in user belongs to with at least `minRole`.
 * 404s for non-members (and members below the role) so event ids can't be probed.
 */
export async function requireEventAccess(eventId: string, minRole: EventRole = "REVIEWER") {
  const user = await requireUser();
  const membership = await prisma.eventMember.findUnique({
    where: { eventId_userId: { eventId, userId: user.id } },
    include: { event: true },
  });
  if (!membership || !atLeast(membership.role, minRole)) notFound();
  return { user, event: membership.event, role: membership.role as EventRole, membership };
}

/** Same check for server actions: returns null instead of throwing a 404. */
export async function eventAccessOrNull(user: Pick<CurrentUser, "id">, eventId: string, minRole: EventRole = "REVIEWER") {
  const membership = await prisma.eventMember.findUnique({
    where: { eventId_userId: { eventId, userId: user.id } },
    include: { event: true },
  });
  if (!membership || !atLeast(membership.role, minRole)) return null;
  return { event: membership.event, role: membership.role as EventRole };
}

export function slugify(name: string) {
  const base = name.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").slice(0, 50) || "event";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export { appUrl } from "@/lib/app-url";
