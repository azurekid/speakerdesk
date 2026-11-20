import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { InvitationResponse } from "@/components/speakers/invitation-response";
import { Badge, ButtonLink, CoverImage, EmptyState, formatDate, formatDateRange, PageHeader, Skeleton } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { eventWhere } from "@/lib/domain";

export const metadata: Metadata = { title: "Invitations" };

type Props = PageProps<"/invitations">;

const STATUS_STYLE = {
  PENDING: "bg-sky-50 text-sky-800 ring-sky-200",
  ACCEPTED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  DECLINED: "bg-neutral-100 text-ink-soft ring-line",
  WITHDRAWN: "bg-neutral-100 text-ink-soft ring-line",
} as const;

export default function InvitationsPage(props: Props) {
  return (
    <>
      <PageHeader eyebrow="Speaker" title="Invitations" description="Organizers who'd like you on their stage." />
      <Suspense fallback={<Skeleton rows={3} />}>
        <Invitations searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Invitations({ searchParams }: { searchParams: Props["searchParams"] }) {
  const user = await requireUser();
  const { accepted } = await searchParams;
  const [invitations, talks, profile] = await Promise.all([
    prisma.speakerInvitation.findMany({
      where: { speakerId: user.id, status: { not: "WITHDRAWN" } },
      include: { event: true, talk: { select: { id: true, title: true } }, invitedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.talk.findMany({ where: { userId: user.id, archived: false }, select: { id: true, title: true }, orderBy: { updatedAt: "desc" } }),
    prisma.speakerProfile.findUnique({ where: { userId: user.id }, select: { publicProfile: true } }),
  ]);

  return (
    <div className="space-y-6">
      {accepted === "1" && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Accepted — the session is on the programme and in your <Link href="/submissions" className="font-medium underline">tracker</Link>.
        </p>
      )}
      {invitations.length === 0 ? (
        <EmptyState
          title="No invitations yet"
          photo="/images/events/audience-question.jpg"
          action={!profile?.publicProfile && <ButtonLink href="/profile">Publish your speaker page</ButtonLink>}
        >
          {profile?.publicProfile ? "Organizers who find you in the speaker directory can invite you here." : "Publish your speaker page so organizers can find you and invite you."}
        </EmptyState>
      ) : (
        invitations.map((inv) => (
          <article key={inv.id} className="grid overflow-hidden rounded-2xl border border-line bg-surface md:grid-cols-[260px_1fr]">
            <div className="relative min-h-40 bg-night">
              <CoverImage src={inv.event.coverImage} fit={inv.event.coverFit} position={inv.event.coverPosition} sizes="260px" />
            </div>
            <div className="space-y-4 p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/events/${inv.event.slug}`} className="text-xl font-semibold tracking-tight hover:text-brand-700">{inv.event.name}</Link>
                  <p className="text-sm text-ink-soft">{formatDateRange(inv.event.startDate, inv.event.endDate)}{eventWhere(inv.event) && ` · ${eventWhere(inv.event)}`}</p>
                </div>
                <Badge className={STATUS_STYLE[inv.status]}>{inv.status[0] + inv.status.slice(1).toLowerCase()}</Badge>
              </div>
              <blockquote className="rounded-xl bg-neutral-50 px-4 py-3 text-sm">
                <p className="whitespace-pre-wrap">{inv.message}</p>
                <footer className="mt-2 text-xs text-ink-soft">— {inv.invitedBy?.name ?? "The organizers"}, {formatDate(inv.createdAt)}</footer>
              </blockquote>
              {inv.talk && <p className="text-sm"><span className="text-ink-soft">They&apos;d love to hear:</span> <span className="font-medium">{inv.talk.title}</span></p>}
              {inv.status === "PENDING" ? (
                talks.length ? (
                  <InvitationResponse invitationId={inv.id} talks={talks} defaultTalkId={inv.talk?.id} />
                ) : (
                  <ButtonLink href="/sessions/new" variant="secondary">Add a session to accept</ButtonLink>
                )
              ) : (
                inv.responseNote && <p className="text-sm text-ink-soft">Your note: {inv.responseNote}</p>
              )}
            </div>
          </article>
        ))
      )}
    </div>
  );
}
