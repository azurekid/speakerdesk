import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DecisionButtons, ReviewForm } from "@/components/organizer/controls";
import { Badge, Card, DecisionBadge, ExternalLink, FormatBadge, Skeleton } from "@/components/ui";
import { presentationLabel } from "@/lib/requirements";
import { prisma } from "@/lib/db";
import { LEVEL_LABELS } from "@/lib/domain";
import { requireEventAccess } from "@/lib/organizer";
import { canManage } from "@/lib/permissions";
import { hideSpeaker } from "@/lib/proposal-queries";

export const metadata: Metadata = { title: "Proposal" };

type Props = PageProps<"/organize/[eventId]/proposals/[proposalId]">;

export default function ProposalPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={5} />}>
      <ProposalDetail params={props.params} />
    </Suspense>
  );
}

async function ProposalDetail({ params }: { params: Props["params"] }) {
  const { eventId, proposalId } = await params;
  const { user, event, role } = await requireEventAccess(eventId);
  const p = await prisma.proposal.findFirst({
    where: { id: proposalId, eventId },
    include: {
      reviews: { include: { reviewer: { select: { name: true } } }, orderBy: { updatedAt: "desc" } },
      speaker: { select: { name: true, profile: true } },
    },
  });
  if (!p) notFound();
  const anonymous = hideSpeaker(event, role);
  const profile = p.speaker.profile;
  const mine = p.reviews.find((r) => r.reviewerId === user.id);
  const ownProposal = p.speakerId === user.id;
  const avg = p.reviews.length ? p.reviews.reduce((a, r) => a + r.score, 0) / p.reviews.length : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <article className="min-w-0 space-y-6">
        <div>
          <Link href={`/organize/${eventId}/proposals`} className="text-xs text-ink-soft hover:text-ink">← All proposals</Link>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            <FormatBadge format={p.format} />
            <span>{p.durationMinutes} min · {LEVEL_LABELS[p.level]}{p.track && ` · ${p.track}`}</span>
            {p.withdrawn && <span className="font-medium text-rose-700">Withdrawn by speaker</span>}
          </div>
          <h2 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight">{p.title}</h2>
        </div>
        <section>
          <h3 className="text-xs font-semibold text-ink-soft">Abstract</h3>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere]">{p.abstract}</p>
        </section>
        {p.takeaways.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-ink-soft">Key takeaways</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">{p.takeaways.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </section>
        )}
        {(p.requirements.length > 0 || p.requirementsNote) && (
          <section>
            <h3 className="text-xs font-semibold text-ink-soft">Needs to present</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.requirements.map((r) => <Badge key={r}>{presentationLabel(r)}</Badge>)}
            </div>
            {p.requirementsNote && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{p.requirementsNote}</p>}
          </section>
        )}
        {p.notes && (
          <section className="rounded-md bg-neutral-100 p-4">
            <h3 className="text-xs font-semibold text-ink-soft">Note to organizers</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm">{p.notes}</p>
          </section>
        )}

        <Card title="Speaker">
          {anonymous ? (
            <p className="text-sm text-ink-soft">This event uses anonymous review — speaker details are hidden from reviewers.</p>
          ) : (
            <div className="flex gap-4">
              {profile?.headshotSquareUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary CDN hosts
                <img src={profile.headshotSquareUrl} alt="" className="size-16 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="grid size-16 shrink-0 place-items-center rounded-full bg-neutral-200 font-display tracking-tight text-xl">{(profile?.fullName || p.speaker.name)[0]}</span>
              )}
              <div className="min-w-0 text-sm">
                <p className="font-display tracking-tight text-lg font-semibold">{profile?.fullName || p.speaker.name}</p>
                {profile?.tagline && <p className="text-ink-soft">{profile.tagline}</p>}
                {(profile?.city || profile?.country) && <p className="text-xs text-ink-soft">{[profile?.city, profile?.country].filter(Boolean).join(", ")}</p>}
                {(profile?.bioMedium || profile?.bioLong || profile?.bioShort) && (
                  <p className="mt-3 whitespace-pre-wrap leading-relaxed text-ink-soft">{profile?.bioMedium || profile?.bioLong || profile?.bioShort}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  {profile?.websiteUrl && <ExternalLink href={profile.websiteUrl}>Website</ExternalLink>}
                  {profile?.linkedinUrl && <ExternalLink href={profile.linkedinUrl}>LinkedIn</ExternalLink>}
                  {profile?.githubUrl && <ExternalLink href={profile.githubUrl}>GitHub</ExternalLink>}
                  {profile?.youtubeUrl && <ExternalLink href={profile.youtubeUrl}>YouTube</ExternalLink>}
                </div>
              </div>
            </div>
          )}
        </Card>
      </article>

      <aside className="space-y-6 lg:sticky lg:top-8 lg:self-start">
        {canManage(role) && !p.withdrawn && (
          <Card title="Decision" actions={<DecisionBadge decision={p.decision} />}>
            <DecisionButtons key={p.decision} proposalId={p.id} decision={p.decision} />
            <p className="mt-3 text-xs text-ink-soft">
              {p.decision === "UNDECIDED" ? "Speakers aren't notified until you publish decisions." : p.decisionPublished ? "Sent to the speaker." : "Not sent yet — publish from the overview."}
            </p>
          </Card>
        )}
        {!ownProposal && !p.withdrawn && (
          <Card title={mine ? "Your review" : "Review"}>
            <ReviewForm proposalId={p.id} score={mine?.score} comment={mine?.comment} />
          </Card>
        )}
        <Card title="Team reviews" description={avg !== null ? `Average ${avg.toFixed(1)} from ${p.reviews.length}` : "No reviews yet"}>
          {p.reviews.length === 0 ? (
            <p className="text-sm text-ink-soft">Be the first to score this one.</p>
          ) : (
            <ul className="space-y-4">
              {p.reviews.map((r) => (
                <li key={r.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{r.reviewerId === user.id ? "You" : r.reviewer.name}</span>
                    <span className="font-display tracking-tight text-lg tabular-nums">{r.score}<span className="text-xs text-ink-soft">/5</span></span>
                  </div>
                  {r.comment && <p className="mt-1 whitespace-pre-wrap text-ink-soft">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </aside>
    </div>
  );
}
