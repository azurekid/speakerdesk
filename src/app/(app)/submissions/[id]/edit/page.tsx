import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionButton } from "@/components/form-controls";
import { SubmissionForm } from "@/components/submission-form";
import { PageHeader, Skeleton, toDateInput } from "@/components/ui";
import { withdrawProposal } from "@/lib/actions/proposals";
import { deleteSubmission, updateSubmission } from "@/lib/actions/submissions";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";

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
    prisma.submission.findFirst({ where: { id, userId: user.id }, include: { proposal: { include: { event: { select: { name: true, slug: true } } } } } }),
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
      <SubmissionForm
        talks={talks}
        action={updateSubmission.bind(null, s.id)}
        cancelHref="/submissions"
        values={{
          talkId: s.talkId ?? "", eventName: s.eventName, eventUrl: s.eventUrl, cfpUrl: s.cfpUrl, platform: s.platform,
          location: s.location, status: s.status, cfpDeadline: toDateInput(s.cfpDeadline), eventStart: toDateInput(s.eventStart),
          eventEnd: toDateInput(s.eventEnd), submittedAt: toDateInput(s.submittedAt), recordingUrl: s.recordingUrl, notes: s.notes,
        }}
      />
    </>
  );
}
