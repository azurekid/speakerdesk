import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProposalForm } from "@/components/events/proposal-form";
import { ButtonLink, formatDate, PageHeader, Skeleton } from "@/components/ui";
import { submitProposal } from "@/lib/actions/proposals";
import { prisma } from "@/lib/db";
import { getOrCreateProfile, requireUser } from "@/lib/dal";
import { cfpState } from "@/lib/domain";

export const metadata: Metadata = { title: "Submit a session", robots: { index: false } };

export default function SubmitPage(props: PageProps<"/events/[slug]/submit">) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Suspense fallback={<Skeleton rows={4} />}>
        <Submit params={props.params} />
      </Suspense>
    </main>
  );
}

async function Submit({ params }: { params: PageProps<"/events/[slug]/submit">["params"] }) {
  const user = await requireUser();
  const { slug } = await params;
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event || !event.cfpPublished) notFound();

  const header = (
    <PageHeader
      eyebrow={`Call for papers · closes ${event.cfpClosesAt ? formatDate(event.cfpClosesAt) : "when full"}`}
      title={event.name}
      description={<>Submitting as yourself. <Link href={`/events/${slug}`} className="underline">Back to the event</Link></>}
    />
  );
  if (cfpState(event) !== "open") {
    return <>{header}<p className="rounded-md bg-neutral-100 px-4 py-3 text-ink-soft">This call for papers is not open for submissions.</p></>;
  }

  const [talks, profile, existing] = await Promise.all([
    prisma.talk.findMany({
      where: { userId: user.id, archived: false },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, abstractShort: true, abstractLong: true, takeaways: true, format: true, durationMinutes: true, level: true, primaryTrack: true, equipmentNeeds: true },
    }),
    getOrCreateProfile(user),
    prisma.proposal.count({ where: { eventId: event.id, speakerId: user.id, withdrawn: false } }),
  ]);

  if (existing >= event.maxProposalsPerSpeaker) {
    return <>{header}<p className="rounded-md bg-neutral-100 px-4 py-3 text-ink-soft">You&apos;ve already sent the maximum of {event.maxProposalsPerSpeaker} proposal{event.maxProposalsPerSpeaker === 1 ? "" : "s"} to this event.</p></>;
  }

  return (
    <>
      {header}
      {(!profile.bioShort && !profile.bioMedium && !profile.bioLong) && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Organizers will see your speaker profile, and it has no bio yet.
          <ButtonLink href="/profile" variant="secondary" size="sm">Add a bio</ButtonLink>
        </div>
      )}
      <ProposalForm
        talks={talks}
        rules={{ titleLimit: event.titleLimit, abstractLimit: event.abstractLimit, formats: event.formats, tracks: event.tracks }}
        action={submitProposal.bind(null, event.id)}
        cancelHref={`/events/${slug}`}
      />
    </>
  );
}
