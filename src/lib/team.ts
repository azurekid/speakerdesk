import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

export const INVITE_TTL_DAYS = 14;

export function newInviteToken() {
  return randomBytes(24).toString("base64url");
}

/** Turns every open invite for this email into a team membership. Never downgrades an existing role. */
export async function claimInvites(userId: string, email: string) {
  const invites = await prisma.eventInvite.findMany({
    where: { email: email.toLowerCase(), acceptedAt: null, expiresAt: { gt: new Date() } },
  });
  for (const invite of invites) {
    await prisma.$transaction([
      prisma.eventMember.upsert({
        where: { eventId_userId: { eventId: invite.eventId, userId } },
        create: { eventId: invite.eventId, userId, role: invite.role, title: invite.title },
        update: {},
      }),
      prisma.eventInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
    ]);
  }
  return invites.length;
}
