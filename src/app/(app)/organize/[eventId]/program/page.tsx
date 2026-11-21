import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/form-controls";
import { Badge, ButtonLink, Card, EmptyState, FormatBadge, Skeleton } from "@/components/ui";
import { InviteSpeakerForm } from "@/components/speakers/invite-speaker-form";
import { withdrawSpeakerInvitation } from "@/lib/actions/speaker-invitations";
import { searchSpeakers } from "@/lib/speaker-directory";
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
      <Program params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Program({ params, searchParams }: { params: Props["params"]; searchParams: Props["searchParams"] }) {
  const { eventId } = await params;
  const { find } = await searchParams;
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

      <InvitedSpeakers eventId={eventId} eventName={event.name} manager={canManage(role)} userId={user.id} find={typeof find === "string" ? find : undefined} />

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

async function InvitedSpeakers({ eventId, eventName, manager, userId, find }: { eventId: string; eventName: string; manager: boolean; userId: string; find?: string }) {
  const invitations = await prisma.speakerInvitation.findMany({
    where: { eventId },
    include: { speaker: { select: { name: true, profile: { select: { fullName: true, slug: true } } } }, talk: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <Card
      title="Invited speakers"
      description="Invite speakers from the SpeakerDesk directory. Accepted invitations land on the programme automatically."
      actions={<ButtonLink href="/speakers" variant="ghost" size="sm">Browse directory</ButtonLink>}
    >
      {manager && <InviteSearch eventId={eventId} eventName={eventName} userId={userId} find={find} />}
      {invitations.length === 0 ? (
        <p className="text-sm text-ink-soft">No invitations yet.</p>
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

/**
 * Find a speaker and invite them to this event, without leaving the workspace. Searches public
 * profiles that accept invitations; people already invited or already proposing are left out.
 */
async function InviteSearch({ eventId, eventName, userId, find }: { eventId: string; eventName: string; userId: string; find?: string }) {
  const q = (find ?? "").trim().slice(0, 80);
  const results = q
    ? (await searchSpeakers(q)).filter((p) => p.userId !== userId && p.openToInvites)
    : [];
  const busy = q && results.length
    ? new Set([
        ...(await prisma.speakerInvitation.findMany({ where: { eventId, status: "PENDING", speakerId: { in: results.map((r) => r.userId) } }, select: { speakerId: true } })).map((r) => r.speakerId),
        ...(await prisma.proposal.findMany({ where: { eventId, withdrawn: false, speakerId: { in: results.map((r) => r.userId) } }, select: { speakerId: true } })).map((r) => r.speakerId),
      ])
    : new Set<string>();

  return (
    <div id="invite" className="mb-5 scroll-mt-6 rounded-xl border border-line p-4">
      <form method="get" action="#invite" className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-sm font-medium">Invite a speaker</span>
          <input name="find" defaultValue={q} placeholder="Name, topic or talk title" className="control" />
        </label>
        <button type="submit" className="inline-flex min-h-10 items-center rounded-lg bg-ink px-4 text-sm font-medium text-paper">Search</button>
      </form>
      {q && (
        results.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">No public speakers taking invitations match “{q}”. Only speakers who published their profile and accept invitations can be found.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {results.slice(0, 12).map((p) => (
              <li key={p.userId} className="py-3">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3">
                    {p.headshotSquareUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- speaker-provided image host
                      <img src={p.headshotSquareUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-100 text-sm font-semibold">{p.fullName[0]}</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{p.fullName}</span>
                      <span className="block truncate text-xs text-ink-soft">{[p.tagline, `${p.user.talks.length} published talk${p.user.talks.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</span>
                    </span>
                    {busy.has(p.userId) ? (
                      <span className="text-xs text-ink-soft">Already invited or proposing</span>
                    ) : (
                      <span className="inline-flex min-h-9 items-center rounded-lg border border-line px-3 text-sm group-open:hidden">Invite…</span>
                    )}
                  </summary>
                  {!busy.has(p.userId) && (
                    <div className="mt-3 rounded-lg bg-neutral-50 p-4">
                      <p className="mb-3 text-xs text-ink-soft">
                        To {eventName}. <Link href={`/speakers/${p.slug}`} className="underline" target="_blank">View {p.fullName.split(" ")[0]}&apos;s profile</Link>
                      </p>
                      <InviteSpeakerForm speakerId={p.userId} speakerName={p.fullName} events={[{ id: eventId, name: eventName }]} talks={p.user.talks} />
                    </div>
                  )}
                </details>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
