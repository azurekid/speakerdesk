"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { appUrl, eventAccessOrNull } from "@/lib/organizer";
import { type ActionState, fieldErrors, formToObject, speakerInviteSchema } from "@/lib/validation";

/** Organizer invites a speaker (who opted in to invitations) to one of their events. */
export async function inviteSpeaker(speakerId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = speakerInviteSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };
  const { eventId, talkId, message } = parsed.data;

  if (!(await eventAccessOrNull(user, eventId, "ORGANIZER"))) return { ok: false, message: "You can only invite speakers to events you organize." };
  if (speakerId === user.id) return { ok: false, message: "You can't invite yourself." };
  const profile = await prisma.speakerProfile.findUnique({ where: { userId: speakerId } });
  if (!profile?.publicProfile || !profile.openToInvites) return { ok: false, message: "This speaker isn't taking invitations right now." };
  if (talkId && !(await prisma.talk.count({ where: { id: talkId, userId: speakerId, published: true } }))) {
    return { ok: false, message: "That talk isn't published.", errors: { talkId: ["Pick one of the speaker's published talks"] } };
  }
  const pending = await prisma.speakerInvitation.count({ where: { eventId, speakerId, status: "PENDING" } });
  if (pending) return { ok: false, message: "There's already an open invitation for this speaker to that event." };
  const onProgramme = await prisma.proposal.count({ where: { eventId, speakerId, withdrawn: false } });
  if (onProgramme) return { ok: false, message: "This speaker already has a proposal for that event." };

  await prisma.speakerInvitation.create({ data: { eventId, speakerId, talkId: talkId || null, invitedById: user.id, message } });
  revalidatePath(`/organize/${eventId}`, "layout");
  revalidatePath("/invitations");
  revalidatePath("/dashboard");
  return { ok: true, message: "Invitation sent. The speaker sees it in their SpeakerDesk inbox." };
}

export async function withdrawSpeakerInvitation(invitationId: string): Promise<void> {
  const user = await requireUser();
  const inv = await prisma.speakerInvitation.findUnique({ where: { id: invitationId } });
  if (!inv || inv.status !== "PENDING" || !(await eventAccessOrNull(user, inv.eventId, "ORGANIZER"))) return;
  await prisma.speakerInvitation.update({ where: { id: invitationId }, data: { status: "WITHDRAWN", respondedAt: new Date() } });
  revalidatePath(`/organize/${inv.eventId}`, "layout");
  revalidatePath("/invitations");
}

/**
 * Speaker accepts: the chosen talk goes straight onto the programme as an accepted,
 * invited session, and into the speaker's own tracker.
 */
export async function acceptSpeakerInvitation(invitationId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const inv = await prisma.speakerInvitation.findFirst({ where: { id: invitationId, speakerId: user.id }, include: { event: true } });
  if (!inv || inv.status !== "PENDING") return { ok: false, message: "This invitation is no longer open." };
  const talkId = String(form.get("talkId") ?? "");
  const talk = await prisma.talk.findFirst({ where: { id: talkId, userId: user.id } });
  if (!talk) return { ok: false, message: "Pick the session you'll give.", errors: { talkId: ["Pick a session"] } };
  const note = String(form.get("note") ?? "").trim().slice(0, 2000);
  const event = inv.event;

  await prisma.$transaction(async (tx) => {
    const submission = await tx.submission.create({
      data: {
        userId: user.id,
        talkId: talk.id,
        eventName: event.name,
        eventUrl: `${appUrl()}/events/${event.slug}`,
        platform: "SPEAKERDESK",
        location: event.location,
        status: "ACCEPTED",
        eventStart: event.startDate,
        eventEnd: event.endDate,
        submittedAt: new Date(),
        decisionAt: new Date(),
        externalId: `speakerdesk-invite:${inv.id}`,
        notes: "Invited by the organizers.",
      },
    });
    const proposal = await tx.proposal.create({
      data: {
        eventId: event.id,
        speakerId: user.id,
        talkId: talk.id,
        submissionId: submission.id,
        title: talk.title,
        abstract: talk.abstractLong || talk.abstractShort || talk.title,
        takeaways: talk.takeaways,
        format: talk.format,
        durationMinutes: talk.durationMinutes,
        level: talk.level,
        track: event.tracks.includes(talk.primaryTrack) ? talk.primaryTrack : "",
        notes: note,
        requirementsNote: talk.equipmentNeeds,
        invited: true,
        decision: "ACCEPTED",
        decisionPublished: true,
        decidedAt: new Date(),
      },
    });
    await tx.speakerInvitation.update({ where: { id: inv.id }, data: { status: "ACCEPTED", responseNote: note, respondedAt: new Date(), proposalId: proposal.id, talkId: talk.id } });
  });
  revalidatePath("/invitations");
  revalidatePath("/submissions");
  revalidatePath("/dashboard");
  revalidatePath(`/organize/${event.id}`, "layout");
  revalidatePath(`/events/${event.slug}`);
  redirect("/invitations?accepted=1");
}

export async function declineSpeakerInvitation(invitationId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const inv = await prisma.speakerInvitation.findFirst({ where: { id: invitationId, speakerId: user.id } });
  if (!inv || inv.status !== "PENDING") return { ok: false, message: "This invitation is no longer open." };
  await prisma.speakerInvitation.update({
    where: { id: invitationId },
    data: { status: "DECLINED", responseNote: String(form.get("note") ?? "").trim().slice(0, 2000), respondedAt: new Date() },
  });
  revalidatePath("/invitations");
  revalidatePath(`/organize/${inv.eventId}`, "layout");
  return { ok: true, message: "Declined. The organizers have been told." };
}
