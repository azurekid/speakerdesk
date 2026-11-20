import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/form-controls";
import { Badge, ButtonLink, Card, EmptyState, FormatBadge, Skeleton } from "@/components/ui";
import { withdrawSpeakerInvitation } from "@/lib/actions/speaker-invitations";
import { prisma } from "@/lib/db";
import { setProgramPublished } from "@/lib/actions/events";
import { requireEventAccess } from "@/lib/organizer";
import { canManage } from "@/lib/permissions";
import { getEventProposals, hideSpeaker } from "@/lib/proposal-queries";
import { PRESENTATION_REQUIREMENTS } from "@/lib/requirements";

export const metadata: Metadata = { title: "Programme" };

type Props = PageProps<"/organize/[eventId]/program">;

export default function ProgramPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <Program params={props.params} />
    </Suspense>
  );
}

async function Program({ params }: { params: Props["params"] }) {
  const { eventId } = await params;
  const { user, event, role } = await requireEventAccess(eventId);
  const anonymous = hideSpeaker(event, role);
  const proposals = (await getEventProposals(eventId, user.id)).filter((p) => !p.withdrawn);
  const accepted = proposals.filter((p) => p.decision === "ACCEPTED");
  const waitlist = proposals.filter((p) => p.decision === "WAITLISTED").sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));
  const minutes = accepted.reduce((n, p) => n + p.durationMinutes, 0);
  const tracks = event.tracks.length ? event.tracks : [""];
  const groups = tracks.map((t) => ({ track: t, items: accepted.filter((p) => (event.tracks.length ? p.track === t : true)) }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface px-5 py-4">
        <p className="text-sm">
          <span className="font-display tracking-tight text-2xl font-semibold">{accepted.length}</span> accepted sessions ·{" "}
          <span className="text-ink-soft">{Math.floor(minutes / 60)}h {minutes % 60}m of content</span>
        </p>
        {canManage(role) && (
          <ActionButton action={setProgramPublished.bind(null, event.id, !event.programPublished)} variant={event.programPublished ? "secondary" : "accent"}>
            {event.programPublished ? "Hide programme from public page" : "Publish programme"}
          </ActionButton>
        )}
      </div>

      {accepted.length === 0 ? (
        <EmptyState title="Nothing accepted yet" photo="/images/events/workshop.jpg">
          Accept proposals from the <Link href={`/organize/${eventId}/proposals`} className="underline">proposals list</Link> to build your programme.
        </EmptyState>
      ) : (
        groups.map(({ track, items }) => (
          <section key={track || "all"}>
            {track && <h2 className="mb-3 font-display tracking-tight text-2xl font-semibold">{track} <span className="text-base text-ink-soft">({items.length})</span></h2>}
            {items.length === 0 ? (
              <p className="rounded-md border border-dashed border-line px-4 py-6 text-sm text-ink-soft">No sessions accepted for this track yet.</p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                {items.map((p) => (
                  <li key={p.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <Link href={`/organize/${eventId}/proposals/${p.id}`} className="font-medium hover:text-brand-700">{p.title}</Link>
                      <p className="text-sm text-ink-soft">{anonymous ? "Anonymous speaker" : p.speakerName}{p.invited && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700">Invited</span>}</p>
                    </div>
                    <FormatBadge format={p.format} />
                    <span className="w-16 text-right text-sm tabular-nums text-ink-soft">{p.durationMinutes} min</span>
                    {!p.decisionPublished && <span className="text-[11px] text-brand-700">unsent</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}

      <InvitedSpeakers eventId={eventId} manager={canManage(role)} />

      {accepted.length > 0 && <ProductionChecklist sessions={accepted} />}

      {waitlist.length > 0 && (
        <Card title="Waitlist" description="Highest rated first — your back-ups if someone drops out.">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {waitlist.map((p) => (
              <li key={p.id}>
                <Link href={`/organize/${eventId}/proposals/${p.id}`} className="hover:text-brand-700">{p.title}</Link>
                {p.avgScore !== null && <span className="text-ink-soft"> · {p.avgScore.toFixed(1)}</span>}
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

/** What the AV / venue team has to prepare, aggregated over accepted sessions. */
function ProductionChecklist({ sessions }: { sessions: { id: string; title: string; requirements: string[]; requirementsNote: string }[] }) {
  const notes = sessions.filter((s) => s.requirementsNote);
  const groups = PRESENTATION_REQUIREMENTS.map((g) => ({
    group: g.group,
    items: g.items
      .map((item) => ({ ...item, sessions: sessions.filter((s) => s.requirements.includes(item.id)) }))
      .filter((i) => i.sessions.length),
  })).filter((g) => g.items.length);

  return (
    <Card title="Production checklist" description="What speakers of accepted sessions asked for. Share it with your AV and venue team.">
      {groups.length === 0 && !notes.length ? (
        <p className="text-sm text-ink-soft">No requirements yet.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {groups.map((g) => (
            <div key={g.group}>
              <h3 className="mb-2 text-xs font-medium text-ink-soft">{g.group}</h3>
              <ul className="space-y-2">
                {g.items.map((i) => (
                  <li key={i.id} className="text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{i.label}</span>
                      <span className="rounded-full bg-neutral-100 px-2 text-xs tabular-nums">{i.sessions.length}</span>
                    </div>
                    <p className="truncate text-xs text-ink-soft">{i.sessions.map((s) => s.title).join(" · ")}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {notes.length > 0 && (
            <div className="md:col-span-2">
              <h3 className="mb-2 text-xs font-medium text-ink-soft">Notes from speakers</h3>
              <ul className="space-y-2 text-sm">
                {notes.map((s) => <li key={s.id}><span className="font-medium">{s.title}:</span> <span className="text-ink-soft">{s.requirementsNote}</span></li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

async function InvitedSpeakers({ eventId, manager }: { eventId: string; manager: boolean }) {
  const invitations = await prisma.speakerInvitation.findMany({
    where: { eventId },
    include: { speaker: { select: { name: true, profile: { select: { fullName: true, slug: true } } } }, talk: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <Card
      title="Invited speakers"
      description="Speakers you invited from the directory. Accepted invitations land on the programme automatically."
      actions={<ButtonLink href="/speakers" variant="secondary" size="sm">Find speakers</ButtonLink>}
    >
      {invitations.length === 0 ? (
        <p className="text-sm text-ink-soft">No invitations yet. Browse the speaker directory and invite people you&apos;d love on stage.</p>
      ) : (
        <ul className="divide-y divide-line">
          {invitations.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                {i.speaker.profile?.slug ? (
                  <Link href={`/speakers/${i.speaker.profile.slug}`} className="font-medium hover:text-brand-700">{i.speaker.profile.fullName || i.speaker.name}</Link>
                ) : (
                  <span className="font-medium">{i.speaker.name}</span>
                )}
                <p className="truncate text-xs text-ink-soft">{i.talk?.title ?? "Speaker's choice"}{i.responseNote && ` · “${i.responseNote}”`}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={{ PENDING: "bg-sky-50 text-sky-800 ring-sky-200", ACCEPTED: "bg-emerald-50 text-emerald-800 ring-emerald-200", DECLINED: "bg-neutral-100 text-ink-soft ring-line", WITHDRAWN: "bg-neutral-100 text-ink-soft ring-line" }[i.status]}>
                  {i.status[0] + i.status.slice(1).toLowerCase()}
                </Badge>
                {manager && i.status === "PENDING" && (
                  <ActionButton action={withdrawSpeakerInvitation.bind(null, i.id)} variant="ghost" confirmText="Withdraw this invitation?">Withdraw</ActionButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
