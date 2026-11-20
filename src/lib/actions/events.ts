"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { DECISION_TO_STATUS, DECISIONS, type Decision } from "@/lib/domain";
import { eventAccessOrNull, slugify } from "@/lib/organizer";
import type { EventRole } from "@/lib/permissions";
import { type ActionState, eventSchema, fieldErrors, formToObject, reviewSchema } from "@/lib/validation";

function parseEvent(form: FormData) {
  return eventSchema.safeParse(formToObject(form, ["tracks", "formats"]));
}

function revalidateEvent(eventId: string, slug?: string) {
  revalidatePath("/organize");
  revalidatePath(`/organize/${eventId}`, "layout");
  revalidatePath("/events");
  if (slug) revalidatePath(`/events/${slug}`);
}

export async function createEvent(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseEvent(form);
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };
  const { coverImage, ...data } = parsed.data;
  const event = await prisma.event.create({
    data: {
      ...data,
      coverImage: coverImage || undefined,
      slug: slugify(data.name),
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  revalidatePath("/organize");
  redirect(`/organize/${event.id}`);
}

export async function updateEvent(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const access = await eventAccessOrNull(user, eventId, "ORGANIZER");
  if (!access) return { ok: false, message: "Only owners and co-organizers can change settings." };
  const parsed = parseEvent(form);
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };
  const { coverImage, ...data } = parsed.data;
  await prisma.event.update({ where: { id: eventId }, data: { ...data, coverImage: coverImage || undefined } });
  revalidateEvent(eventId, access.event.slug);
  return { ok: true, message: "Event saved." };
}

export async function setCfpPublished(eventId: string, published: boolean): Promise<void> {
  const user = await requireUser();
  const access = await eventAccessOrNull(user, eventId, "ORGANIZER");
  if (!access) return;
  await prisma.event.update({ where: { id: eventId }, data: { cfpPublished: published } });
  revalidateEvent(eventId, access.event.slug);
}

export async function setProgramPublished(eventId: string, published: boolean): Promise<void> {
  const user = await requireUser();
  const access = await eventAccessOrNull(user, eventId, "ORGANIZER");
  if (!access) return;
  await prisma.event.update({ where: { id: eventId }, data: { programPublished: published } });
  revalidateEvent(eventId, access.event.slug);
}

export async function deleteEvent(eventId: string): Promise<void> {
  const user = await requireUser();
  const access = await eventAccessOrNull(user, eventId, "OWNER");
  if (!access) return;
  await prisma.event.delete({ where: { id: eventId } });
  revalidatePath("/organize");
  revalidatePath("/events");
  redirect("/organize");
}

// ─── Reviews & decisions ─────────────────────────────────────────────────────

async function proposalForMember(userId: string, proposalId: string, minRole: EventRole) {
  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal) return null;
  const access = await eventAccessOrNull({ id: userId }, proposal.eventId, minRole);
  return access ? { proposal, event: access.event } : null;
}

export async function saveReview(proposalId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const found = await proposalForMember(user.id, proposalId, "REVIEWER");
  if (!found) return { ok: false, message: "Proposal not found." };
  if (found.proposal.speakerId === user.id) return { ok: false, message: "You can't review your own proposal." };
  const parsed = reviewSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };
  await prisma.review.upsert({
    where: { proposalId_reviewerId: { proposalId, reviewerId: user.id } },
    create: { proposalId, reviewerId: user.id, ...parsed.data },
    update: parsed.data,
  });
  revalidatePath(`/organize/${found.event.id}`, "layout");
  return { ok: true, message: "Review saved." };
}

export async function setDecision(proposalId: string, decision: Decision): Promise<void> {
  const user = await requireUser();
  if (!DECISIONS.includes(decision)) return;
  const found = await proposalForMember(user.id, proposalId, "ORGANIZER");
  if (!found || found.proposal.withdrawn) return;
  await prisma.proposal.update({
    where: { id: proposalId },
    // Changing a decision un-publishes it until the owner publishes again.
    data: { decision, decidedAt: decision === "UNDECIDED" ? null : new Date(), decisionPublished: false },
  });
  revalidatePath(`/organize/${found.event.id}`, "layout");
}

/** Sends every decided-but-unpublished decision to the speakers' trackers. */
export async function publishDecisions(eventId: string): Promise<void> {
  const user = await requireUser();
  const access = await eventAccessOrNull(user, eventId, "ORGANIZER");
  if (!access) return;
  const pending = await prisma.proposal.findMany({
    where: { eventId, withdrawn: false, decisionPublished: false, decision: { not: "UNDECIDED" } },
  });
  await prisma.$transaction(
    pending.flatMap((p) => {
      const status = DECISION_TO_STATUS[p.decision as Exclude<Decision, "UNDECIDED">];
      return [
        prisma.proposal.update({ where: { id: p.id }, data: { decisionPublished: true } }),
        ...(p.submissionId
          ? [prisma.submission.update({ where: { id: p.submissionId }, data: { status, decisionAt: new Date() } })]
          : []),
      ];
    }),
  );
  revalidateEvent(eventId, access.event.slug);
  revalidatePath("/submissions");
  revalidatePath("/dashboard");
}
