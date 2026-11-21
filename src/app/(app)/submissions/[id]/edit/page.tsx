import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionButton } from "@/components/form-controls";
import { SubmissionForm } from "@/components/submission-form";
import { AcceptanceResponse } from "@/components/speakers/acceptance-response";
import { PageHeader, Skeleton, toDateInput } from "@/components/ui";
import { withdrawProposal } from "@/lib/actions/proposals";
import { deleteSubmission, updateSubmission } from "@/lib/actions/submissions";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { dayKey, formatDayLabel, formatRange } from "@/lib/schedule";

export const metadata: Metadata = { title: "Edit submission" };

export default function EditSubmissionPage(props: PageProps<"/submissions/[id]/edit">) {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <EditSubmission params={props.params} />
    </Suspense>
  );
}

async function EditSubmission({ params }: { params: PageProps<"/submissions/[id]/edit">["params"] }) {
  const user = await requireUser();
  const { id } = await params;
  const [s, talks] = await Promise.all([
    prisma.submission.findFirst({ where: { id, userId: user.id }, include: { proposal: { include: { event: { select: { name: true, slug: true, timezone: true, schedulePublished: true } }, room: { select: { name: true } } } } } }),
    prisma.talk.findMany({ where: { userId: user.id }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  if (!s) notFound();
  return (
    <>
      <PageHeader
        title={s.eventName}
        description="Edit submission"
        actions={<ActionButton action={deleteSubmission.bind(null, s.id)} variant="danger" confirmText="Delete this submission?">Delete</ActionButton>}
      />
      {s.proposal && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-5 py-4 text-sm">
          <p>
            Sent through the SpeakerDesk CfP for <Link href={`/events/${s.proposal.event.slug}`} className="font-medium underline">{s.proposal.event.name}</Link>.
            {" "}The organizers update the status here when they publish decisions.
          </p>
          {!s.proposal.withdrawn && !s.proposal.decisionPublished && (
            <ActionButton action={withdrawProposal.bind(null, s.proposal.id)} variant="danger" confirmText="Withdraw this proposal from the event?">Withdraw proposal</ActionButton>
          )}
        </div>
      )}
      {s.proposal && <AcceptedSession proposal={s.proposal} />}
      <SubmissionForm
        talks={talks}
        action={updateSubmission.bind(null, s.id)}
        cancelHref="/submissions"
        values={{
          talkId: s.talkId ?? "", eventName: s.eventName, eventUrl: s.eventUrl, cfpUrl: s.cfpUrl, platform: s.platform,
          location: s.location, status: s.status, cfpDeadline: toDateInput(s.cfpDeadline), eventStart: toDateInput(s.eventStart),
          eventEnd: toDateInput(s.eventEnd), submittedAt: toDateInput(s.submittedAt), recordingUrl: s.recordingUrl, notes: s.notes,
          mvpTechnologyArea: s.mvpTechnologyArea, targetAudience: s.targetAudience, microsoftEvent: s.microsoftEvent,
          inPersonAttendees: s.inPersonAttendees?.toString() ?? "", liveStreamViews: s.liveStreamViews?.toString() ?? "", onDemandViews: s.onDemandViews?.toString() ?? "",
        }}
      />
    </>
  );
}

type AcceptedProposal = {
  id: string; title: string; decision: string; decisionPublished: boolean; withdrawn: boolean; durationMinutes: number;
  confirmation: "PENDING" | "CONFIRMED" | "DECLINED" | null; confirmationNote: string;
  slotDay: Date | null; slotStart: number | null; room: { name: string } | null;
  event: { name: string; slug: string; timezone: string; schedulePublished: boolean };
};

/** After acceptance: confirm or decline, then the time slot once the schedule is out. */
function AcceptedSession({ proposal: p }: { proposal: AcceptedProposal }) {
  if (p.withdrawn || p.decision !== "ACCEPTED" || !p.decisionPublished || !p.confirmation) return null;
  const slot = p.event.schedulePublished && p.slotDay && p.slotStart !== null
    ? { day: formatDayLabel(dayKey(p.slotDay)), time: formatRange(p.slotStart, p.slotStart + p.durationMinutes) }
    : null;
  return (
    <section id="confirm" className="mb-6 scroll-mt-6 rounded-xl border border-line bg-surface px-5 py-5">
      {p.confirmation === "PENDING" && (
        <>
          <h2 className="font-display text-xl font-semibold tracking-tight">Your session was accepted. Will you be there?</h2>
          <p className="mb-4 mt-1 text-sm text-ink-soft">{p.event.name} accepted “{p.title}”. Please confirm, so the organizers can plan the programme.</p>
          <AcceptanceResponse proposalId={p.id} />
        </>
      )}
      {p.confirmation === "CONFIRMED" && (
        <>
          <h2 className="font-display text-xl font-semibold tracking-tight">You&apos;re speaking at {p.event.name}</h2>
          {slot ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm"><span className="font-medium">{slot.day}, {slot.time}</span> <span className="text-ink-soft">({p.event.timezone}){p.room && `, ${p.room.name}`}</span></p>
              <a href={`/events/${p.event.slug}/calendar.ics?session=${p.id}`} className="text-sm font-medium underline underline-offset-4">Add to calendar</a>
            </div>
          ) : (
            <p className="mt-1 text-sm text-ink-soft">Thanks for confirming. Your time slot appears here, and in your inbox, once the organizers publish the schedule.</p>
          )}
        </>
      )}
      {p.confirmation === "DECLINED" && (
        <p className="text-sm text-ink-soft">You let the organizers know you can&apos;t give this session{p.confirmationNote && ` (“${p.confirmationNote}”)`}. It&apos;s no longer on the programme.</p>
      )}
    </section>
  );
}
