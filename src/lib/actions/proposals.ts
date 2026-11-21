"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { renderConfirmation } from "@/lib/confirmation-email";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { cfpState, eventWhere } from "@/lib/domain";
import { sendMailInBackground } from "@/lib/mailer";
import { appUrl } from "@/lib/organizer";
import { type ActionState, fieldErrors, formToObject, proposalSchema } from "@/lib/validation";

export async function submitProposal(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || cfpState(event) !== "open") return { ok: false, message: "This call for papers is not open." };

  const parsed = proposalSchema.safeParse(formToObject(form, ["takeaways", "requirements"]));
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };
  const { talkId, ...data } = parsed.data;

  // Enforce the organizer's rules on the server, not just in the form.
  const errors: Record<string, string[]> = {};
  if (event.titleLimit && data.title.length > event.titleLimit) errors.title = [`This CfP allows ${event.titleLimit} characters`];
  if (event.abstractLimit && data.abstract.length > event.abstractLimit) errors.abstract = [`This CfP allows ${event.abstractLimit} characters`];
  if (event.formats.length && !event.formats.includes(data.format)) errors.format = ["This format isn't accepted here"];
  if (event.tracks.length && !event.tracks.includes(data.track)) errors.track = ["Pick one of the event's tracks"];
  if (Object.keys(errors).length) return { ok: false, message: "This proposal doesn't fit the CfP rules yet.", errors };

  const mine = await prisma.proposal.count({ where: { eventId, speakerId: user.id, withdrawn: false } });
  if (mine >= event.maxProposalsPerSpeaker) {
    return { ok: false, message: `You can send at most ${event.maxProposalsPerSpeaker} proposal${event.maxProposalsPerSpeaker === 1 ? "" : "s"} to this event.` };
  }
  const ownsTalk = talkId ? await prisma.talk.count({ where: { id: talkId, userId: user.id } }) : 0;

  await prisma.$transaction(async (tx) => {
    // Mirror the proposal into the speaker's own tracker.
    const submission = await tx.submission.create({
      data: {
        userId: user.id,
        talkId: ownsTalk ? talkId : null,
        eventName: event.name,
        eventUrl: `${appUrl()}/events/${event.slug}`,
        cfpUrl: `${appUrl()}/events/${event.slug}`,
        platform: "SPEAKERDESK",
        location: eventWhere(event),
        status: "SUBMITTED",
        cfpDeadline: event.cfpClosesAt,
        eventStart: event.startDate,
        eventEnd: event.endDate,
        submittedAt: new Date(),
        externalId: `speakerdesk:${event.id}`,
      },
    });
    await tx.proposal.create({
      data: { ...data, eventId, speakerId: user.id, talkId: ownsTalk ? talkId : null, submissionId: submission.id },
    });
  });

  if (event.confirmationEmailEnabled) {
    // After the commit, and never fatal: the proposal is in even if mail delivery fails
    // (failures show up in Admin → Email outbox).
    try {
      const profile = await prisma.speakerProfile.findUnique({ where: { userId: user.id }, select: { fullName: true } });
      const mail = renderConfirmation(
        { subject: event.confirmationEmailSubject, body: event.confirmationEmailBody },
        {
          SPEAKER_NAME: profile?.fullName || user.name,
          SESSION_NAME: data.title,
          EVENT_NAME: event.name,
          EVENT_URL: `${appUrl()}/events/${event.slug}`,
          DASHBOARD_URL: `${appUrl()}/submissions`,
        },
      );
      sendMailInBackground([{ to: user.email, ...mail, kind: "proposal-confirmation" }]);
    } catch (e) {
      console.error("proposal confirmation email failed", e);
    }
  }

  revalidatePath("/submissions");
  revalidatePath("/dashboard");
  revalidatePath(`/events/${event.slug}`);
  redirect(`/events/${event.slug}?submitted=1`);
}

export async function withdrawProposal(proposalId: string): Promise<void> {
  const user = await requireUser();
  const proposal = await prisma.proposal.findFirst({ where: { id: proposalId, speakerId: user.id }, include: { event: true } });
  if (!proposal || proposal.withdrawn) return;
  await prisma.$transaction([
    prisma.proposal.update({ where: { id: proposalId }, data: { withdrawn: true } }),
    ...(proposal.submissionId ? [prisma.submission.update({ where: { id: proposal.submissionId }, data: { status: "WITHDRAWN" } })] : []),
  ]);
  revalidatePath("/submissions");
  revalidatePath(`/events/${proposal.event.slug}`);
  revalidatePath(`/organize/${proposal.eventId}`, "layout");
}

/**
 * An accepted speaker confirms they'll give the session, or says they can't make it. Declining
 * takes the session off the programme and schedule. The event's organizers are told either way.
 */
export async function respondToAcceptance(proposalId: string, confirm: boolean, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.impersonatedBy) return { ok: false, message: "Support sessions can't answer on the speaker's behalf." };
  const proposal = await prisma.proposal.findFirst({
    where: { id: proposalId, speakerId: user.id, decision: "ACCEPTED", decisionPublished: true, withdrawn: false },
    include: { event: { select: { id: true, name: true, slug: true } } },
  });
  if (!proposal) return { ok: false, message: "This session isn't waiting for your answer." };
  if (proposal.confirmation === "DECLINED") return { ok: false, message: "You already let the organizers know you can't make it." };
  if (confirm && proposal.confirmation === "CONFIRMED") return { ok: true, message: "You've already confirmed this session." };
  const note = String(form.get("note") ?? "").trim().slice(0, 1000);

  await prisma.$transaction([
    prisma.proposal.update({
      where: { id: proposalId },
      data: confirm
        ? { confirmation: "CONFIRMED", confirmationNote: note, confirmedAt: new Date() }
        : { confirmation: "DECLINED", confirmationNote: note, confirmedAt: new Date(), slotDay: null, slotStart: null, roomId: null },
    }),
    ...(!confirm && proposal.submissionId ? [prisma.submission.update({ where: { id: proposal.submissionId }, data: { status: "WITHDRAWN" } })] : []),
  ]);

  const organizers = await prisma.eventMember.findMany({
    where: { eventId: proposal.eventId, role: { in: ["OWNER", "ORGANIZER"] } },
    select: { user: { select: { email: true } } },
  });
  const profile = await prisma.speakerProfile.findUnique({ where: { userId: user.id }, select: { fullName: true } });
  const speaker = profile?.fullName || user.name;
  const link = `${appUrl()}/organize/${proposal.eventId}/program`;
  sendMailInBackground(organizers.map((o) => ({
    to: o.user.email,
    kind: confirm ? "speaker-confirmed" : "speaker-declined",
    subject: confirm ? `${speaker} confirmed “${proposal.title}”` : `${speaker} can't give “${proposal.title}”`,
    text: `${confirm ? `${speaker} confirmed they'll give “${proposal.title}” at ${proposal.event.name}.` : `${speaker} let you know they can't give “${proposal.title}” at ${proposal.event.name} after all. The session has been taken off the programme and the schedule. Your waitlist is on the Programme tab.`}${note ? `\n\nTheir note: “${note}”` : ""}\n\n${link}\n\nSpeakerDesk`,
  })));

  revalidatePath("/submissions");
  revalidatePath("/dashboard");
  revalidatePath(`/events/${proposal.event.slug}`);
  revalidatePath(`/organize/${proposal.eventId}`, "layout");
  return { ok: true, message: confirm ? "Thanks! The organizers know you'll be there." : "Thanks for letting the organizers know. The session is off the programme." };
}
