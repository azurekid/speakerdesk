"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatDateRange } from "@/components/ui";
import { prisma } from "@/lib/db";
import { DECISION_EMAIL_KINDS, DEFAULT_DECISION_EMAILS, type DecisionEmailKind, parseDecisionEmails, renderDecisionEmail, unknownDecisionPlaceholders } from "@/lib/decision-email";
import { sendMailInBackground } from "@/lib/mailer";
import { requireUser } from "@/lib/dal";
import { DECISION_TO_STATUS, DECISIONS, type Decision } from "@/lib/domain";
import { appUrl, eventAccessOrNull, slugify } from "@/lib/organizer";
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
    // Changing a decision un-publishes it until the owner publishes again. A session that is no
    // longer accepted also leaves the schedule and no longer waits for the speaker's confirmation.
    data: {
      decision, decidedAt: decision === "UNDECIDED" ? null : new Date(), decisionPublished: false,
      ...(decision !== "ACCEPTED" ? { confirmation: null, confirmedAt: null, slotDay: null, slotStart: null, roomId: null } : {}),
    },
  });
  revalidatePath(`/organize/${found.event.id}`, "layout");
}

/**
 * Sends every decided-but-unpublished decision to the speakers' trackers and, unless the event
 * turned them off, emails each speaker. Accepted speakers are asked to confirm.
 */
export async function publishDecisions(eventId: string): Promise<void> {
  const user = await requireUser();
  const access = await eventAccessOrNull(user, eventId, "ORGANIZER");
  if (!access) return;
  const { event } = access;
  const pending = await prisma.proposal.findMany({
    where: { eventId, withdrawn: false, decisionPublished: false, decision: { not: "UNDECIDED" } },
    include: { speaker: { select: { email: true, name: true, profile: { select: { fullName: true } } } } },
  });
  await prisma.$transaction(
    pending.flatMap((p) => {
      const status = DECISION_TO_STATUS[p.decision as Exclude<Decision, "UNDECIDED">];
      // Invited speakers already said yes when they accepted the invitation.
      const confirmation = p.decision === "ACCEPTED" ? { confirmation: p.confirmation ?? (p.invited ? "CONFIRMED" as const : "PENDING" as const) } : {};
      return [
        prisma.proposal.update({ where: { id: p.id }, data: { decisionPublished: true, ...confirmation } }),
        ...(p.submissionId
          ? [prisma.submission.update({ where: { id: p.submissionId }, data: { status, decisionAt: new Date() } })]
          : []),
      ];
    }),
  );

  if (event.decisionEmailsEnabled && pending.length) {
    const templates = parseDecisionEmails(event.decisionEmails);
    const kinds: Record<Exclude<Decision, "UNDECIDED">, DecisionEmailKind> = { ACCEPTED: "accepted", WAITLISTED: "waitlisted", REJECTED: "rejected" };
    sendMailInBackground(pending.map((p) => {
      const kind = kinds[p.decision as Exclude<Decision, "UNDECIDED">];
      const mail = renderDecisionEmail(kind, templates, {
        SPEAKER_NAME: p.speaker.profile?.fullName || p.speaker.name,
        SESSION_NAME: p.title,
        EVENT_NAME: event.name,
        EVENT_DATES: formatDateRange(event.startDate, event.endDate),
        EVENT_URL: `${appUrl()}/events/${event.slug}`,
        SESSION_URL: p.submissionId ? `${appUrl()}/submissions/${p.submissionId}/edit` : `${appUrl()}/events/${event.slug}`,
      });
      return { to: p.speaker.email, ...mail, kind: `decision-${kind}` };
    }));
  }
  revalidateEvent(eventId, event.slug);
  revalidatePath("/submissions");
  revalidatePath("/dashboard");
}

/** Saves the decision email templates. Text equal to the built-in template is stored as "". */
export async function updateDecisionEmails(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const access = await eventAccessOrNull(user, eventId, "ORGANIZER");
  if (!access) return { ok: false, message: "Only owners and co-organizers can change these emails." };
  const errors: Record<string, string[]> = {};
  const templates: Record<string, { subject: string; body: string }> = {};
  for (const kind of DECISION_EMAIL_KINDS) {
    const subject = String(form.get(`${kind}Subject`) ?? "").trim().replace(/\s+/g, " ");
    const body = String(form.get(`${kind}Body`) ?? "").replace(/\r\n/g, "\n").trim();
    if (subject.length > 200) errors[`${kind}Subject`] = ["At most 200 characters"];
    if (body.length > 5000) errors[`${kind}Body`] = ["At most 5000 characters"];
    for (const [name, value] of [[`${kind}Subject`, subject], [`${kind}Body`, body]] as const) {
      const unknown = unknownDecisionPlaceholders(value);
      if (unknown.length) errors[name] = [`Unknown placeholder: ${unknown.map((p) => `{${p}}`).join(", ")}`];
    }
    const fallback = DEFAULT_DECISION_EMAILS[kind];
    templates[kind] = { subject: subject === fallback.subject ? "" : subject, body: body === fallback.body ? "" : body };
  }
  if (Object.keys(errors).length) return { ok: false, message: "Please fix the highlighted fields.", errors };
  await prisma.event.update({ where: { id: eventId }, data: { decisionEmailsEnabled: form.get("enabled") === "on", decisionEmails: templates } });
  revalidatePath(`/organize/${eventId}`, "layout");
  return { ok: true, message: "Decision emails saved." };
}
