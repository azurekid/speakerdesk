"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { renderConfirmation } from "@/lib/confirmation-email";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { cfpState, eventWhere } from "@/lib/domain";
import { sendMail } from "@/lib/mailer";
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
      await sendMail({ to: user.email, ...mail, kind: "proposal-confirmation" });
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
