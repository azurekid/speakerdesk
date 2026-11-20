import "server-only";
import { prisma } from "@/lib/db";
import { canManage, type EventRole } from "@/lib/permissions";

/** Proposals for an event with review aggregates, as seen by one team member. */
export async function getEventProposals(eventId: string, viewerId: string) {
  const proposals = await prisma.proposal.findMany({
    where: { eventId },
    include: {
      reviews: { select: { reviewerId: true, score: true } },
      speaker: { select: { name: true, profile: { select: { fullName: true, tagline: true, headshotSquareUrl: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return proposals.map((p) => {
    const scores = p.reviews.map((r) => r.score);
    return {
      ...p,
      speakerName: p.speaker.profile?.fullName || p.speaker.name,
      reviewCount: scores.length,
      avgScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
      myScore: p.reviews.find((r) => r.reviewerId === viewerId)?.score ?? null,
    };
  });
}

export function hideSpeaker(event: { blindReview: boolean }, role: EventRole) {
  return event.blindReview && !canManage(role);
}
