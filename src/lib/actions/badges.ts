"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eligibleRecipients } from "@/lib/badge-queries";
import { BADGE_COLORS, BADGE_ICONS } from "@/lib/badges";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { sendMailInBackground } from "@/lib/mailer";
import { appUrl, eventAccessOrNull } from "@/lib/organizer";
import { type ActionState, fieldErrors, formToObject } from "@/lib/validation";

const badgeSchema = z.object({
  name: z.string().trim().min(2, "Give the badge a name").max(60),
  description: z.string().trim().max(300).default(""),
  icon: z.enum(BADGE_ICONS),
  color: z.enum(Object.keys(BADGE_COLORS) as [keyof typeof BADGE_COLORS, ...(keyof typeof BADGE_COLORS)[]]),
});

const awardSchema = z.object({
  badgeId: z.string().min(1, "Pick a badge"),
  recipientIds: z.array(z.string()).min(1, "Pick at least one person").max(500),
  message: z.string().trim().max(500).default(""),
});

function revalidateBadges(eventId?: string) {
  if (eventId) revalidatePath(`/organize/${eventId}/badges`);
  revalidatePath("/badges");
  // The pending-badge banner and sidebar count are read per request, so nothing site-wide to purge.
}

// ─── Organizers ──────────────────────────────────────────────────────────────

export async function createEventBadge(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!(await eventAccessOrNull(user, eventId, "ORGANIZER"))) return { ok: false, message: "Only owners and co-organizers can create badges." };
  const parsed = badgeSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };
  const count = await prisma.badge.count({ where: { eventId, archived: false } });
  if (count >= 50) return { ok: false, message: "An event can have up to 50 badges. Archive some first." };
  await prisma.badge.create({ data: { ...parsed.data, eventId, createdById: user.id } });
  revalidateBadges(eventId);
  return { ok: true, message: `“${parsed.data.name}” is ready to award.` };
}

export async function archiveEventBadge(badgeId: string): Promise<void> {
  const user = await requireUser();
  const badge = await prisma.badge.findUnique({ where: { id: badgeId } });
  if (!badge?.eventId || !(await eventAccessOrNull(user, badge.eventId, "ORGANIZER"))) return;
  // Archived badges can't be awarded any more; badges already given stay with their owners.
  await prisma.badge.update({ where: { id: badgeId }, data: { archived: true } });
  revalidateBadges(badge.eventId);
}

export async function awardBadge(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const access = await eventAccessOrNull(user, eventId, "ORGANIZER");
  if (!access) return { ok: false, message: "Only owners and co-organizers can award badges." };
  const parsed = awardSchema.safeParse(formToObject(form, ["recipientIds"]));
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };
  const { badgeId, recipientIds, message } = parsed.data;

  const badge = await prisma.badge.findFirst({ where: { id: badgeId, archived: false, OR: [{ eventId: null }, { eventId }] } });
  if (!badge) return { ok: false, message: "That badge isn't available for this event.", errors: { badgeId: ["Pick a badge"] } };
  const eligible = new Map((await eligibleRecipients(eventId, user.id)).map((r) => [r.id, r]));
  const chosen = [...new Set(recipientIds)].filter((id) => eligible.has(id));
  if (!chosen.length) return { ok: false, message: "Badges can go to this event's accepted speakers and team only.", errors: { recipientIds: ["Pick people from the list"] } };

  const existing = await prisma.badgeAward.findMany({ where: { badgeId, eventId, recipientId: { in: chosen } } });
  const byRecipient = new Map(existing.map((a) => [a.recipientId, a]));
  const toNotify: string[] = [];
  let skipped = 0;
  for (const recipientId of chosen) {
    const prev = byRecipient.get(recipientId);
    if (prev && (prev.status === "PENDING" || prev.status === "ACCEPTED" || prev.status === "DECLINED")) {
      skipped++; // already has it, or said no — don't ask again
      continue;
    }
    if (prev) await prisma.badgeAward.update({ where: { id: prev.id }, data: { status: "PENDING", message, awardedById: user.id, respondedAt: null, createdAt: new Date() } });
    else await prisma.badgeAward.create({ data: { badgeId, eventId, recipientId, awardedById: user.id, message } });
    toNotify.push(recipientId);
  }

  if (toNotify.length) {
    const people = await prisma.user.findMany({ where: { id: { in: toNotify } }, select: { email: true, name: true } });
    const event = access.event;
    sendMailInBackground(people.map((p) => ({
      to: p.email,
      kind: "badge-award",
      subject: `${event.name} gave you the “${badge.name}” badge`,
      text: `Hi ${p.name.split(" ")[0]},\n\n${event.name} awarded you the “${badge.name}” badge${badge.description ? `: ${badge.description}` : "."}${message ? `\n\n“${message}”` : ""}\n\nAccept it to add it to your SpeakerDesk profile:\n${appUrl()}/badges\n\nSpeakerDesk`,
    })));
  }
  revalidateBadges(eventId);
  const sent = toNotify.length;
  return {
    ok: sent > 0,
    message: sent
      ? `Awarded to ${sent} ${sent === 1 ? "person" : "people"}. They'll accept it from their SpeakerDesk account.${skipped ? ` ${skipped} already had it (or declined it).` : ""}`
      : "Everyone you picked already has this badge, or declined it before.",
  };
}

export async function revokeBadgeAward(awardId: string): Promise<void> {
  const user = await requireUser();
  const award = await prisma.badgeAward.findUnique({ where: { id: awardId } });
  if (!award || award.status === "REVOKED" || !(await eventAccessOrNull(user, award.eventId, "ORGANIZER"))) return;
  await prisma.badgeAward.update({ where: { id: awardId }, data: { status: "REVOKED", respondedAt: new Date() } });
  revalidateBadges(award.eventId);
}

// ─── Recipients ──────────────────────────────────────────────────────────────

export async function respondToBadge(awardId: string, accept: boolean): Promise<void> {
  const user = await requireUser();
  if (user.impersonatedBy) return; // support sessions don't accept things on someone's behalf
  const award = await prisma.badgeAward.findFirst({ where: { id: awardId, recipientId: user.id } });
  if (!award || award.status === "REVOKED") return;
  await prisma.badgeAward.update({ where: { id: awardId }, data: { status: accept ? "ACCEPTED" : "DECLINED", respondedAt: new Date() } });
  revalidateBadges(award.eventId);
  revalidatePath("/speakers", "layout");
}

export async function setBadgeVisibility(awardId: string, show: boolean): Promise<void> {
  const user = await requireUser();
  const award = await prisma.badgeAward.findFirst({ where: { id: awardId, recipientId: user.id, status: "ACCEPTED" } });
  if (!award) return;
  await prisma.badgeAward.update({ where: { id: awardId }, data: { showOnProfile: show } });
  revalidateBadges();
  revalidatePath("/speakers", "layout");
  revalidatePath(`/credentials/${awardId}`);
}
