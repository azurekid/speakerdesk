import "server-only";
import { prisma } from "@/lib/db";
import { ROLE_LABELS, type EventRole } from "@/lib/permissions";

export type Recipient = { id: string; name: string; group: "Speakers" | "Team"; detail: string };

/**
 * People an event may give badges to: speakers whose acceptance has been published, and the
 * event's team. Nobody else — so badges can't be used to spam arbitrary users.
 */
export async function eligibleRecipients(eventId: string, excludeUserId?: string): Promise<Recipient[]> {
  const [proposals, members] = await Promise.all([
    prisma.proposal.findMany({
      where: { eventId, decision: "ACCEPTED", decisionPublished: true, withdrawn: false, OR: [{ confirmation: null }, { confirmation: { not: "DECLINED" } }] },
      select: { speakerId: true, title: true, speaker: { select: { name: true, profile: { select: { fullName: true } } } } },
      orderBy: { title: "asc" },
    }),
    prisma.eventMember.findMany({
      where: { eventId },
      select: { userId: true, role: true, title: true, user: { select: { name: true, profile: { select: { fullName: true } } } } },
    }),
  ]);
  const out = new Map<string, Recipient>();
  for (const p of proposals) {
    if (p.speakerId === excludeUserId) continue;
    const prev = out.get(p.speakerId);
    if (prev) prev.detail += ` · ${p.title}`;
    else out.set(p.speakerId, { id: p.speakerId, name: p.speaker.profile?.fullName || p.speaker.name, group: "Speakers", detail: p.title });
  }
  for (const m of members) {
    if (m.userId === excludeUserId || out.has(m.userId)) continue;
    out.set(m.userId, { id: m.userId, name: m.user.profile?.fullName || m.user.name, group: "Team", detail: m.title || ROLE_LABELS[m.role as EventRole] });
  }
  return [...out.values()].sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
}

/** Platform badges plus this event's own (not archived), for the award form. */
export function availableBadges(eventId: string) {
  return prisma.badge.findMany({
    where: { archived: false, OR: [{ eventId: null }, { eventId }] },
    orderBy: [{ eventId: { sort: "asc", nulls: "first" } }, { name: "asc" }],
  });
}

/** Accepted, visible badges for a public profile or credential listing. */
export function publicBadgesFor(userId: string) {
  return prisma.badgeAward.findMany({
    where: { recipientId: userId, status: "ACCEPTED", showOnProfile: true },
    include: { badge: true, event: { select: { name: true, slug: true, startDate: true } } },
    orderBy: { createdAt: "desc" },
  });
}
