import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/form-controls";
import { ShareButtons } from "@/components/share";
import { Badge, ButtonLink, Card, DecisionBadge, formatDate, Skeleton } from "@/components/ui";
import { HEALTH_LABELS, HEALTH_STYLES } from "@/lib/runbook";
import { getRunbook } from "@/lib/runbook-queries";
import { publishDecisions, setCfpPublished } from "@/lib/actions/events";
import { cfpState, type Decision } from "@/lib/domain";
import { redirect } from "next/navigation";
import { appUrl, requireEventAccess } from "@/lib/organizer";
import { canManage } from "@/lib/permissions";
import { getEventProposals } from "@/lib/proposal-queries";
import { getSetupGuide } from "@/lib/setup-guide";
import { SetupGuide, ShowGuideLink } from "@/components/organizer/setup-guide";

export const metadata: Metadata = { title: "Event overview" };

type Params = PageProps<"/organize/[eventId]">["params"];

export default function EventOverviewPage(props: PageProps<"/organize/[eventId]">) {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <Overview params={props.params} />
    </Suspense>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="border-l border-line pl-4">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="font-display tracking-tight text-4xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

async function Overview({ params }: { params: Params }) {
  const { eventId } = await params;
  const { user, event, role } = await requireEventAccess(eventId, "VOLUNTEER");
  if (role === "VOLUNTEER") redirect(`/organize/${eventId}/runbook`);
  const [proposals, runbook, guide] = await Promise.all([
    getEventProposals(eventId, user.id),
    getRunbook(eventId),
    canManage(role) ? getSetupGuide(eventId, user.id) : null,
  ]);
  const h = runbook.health;
  const nextUp = runbook.tasks.filter((t) => t.effectiveStatus !== "DONE").slice(0, 4);
  const active = proposals.filter((p) => !p.withdrawn);
  const count = (d: Decision) => active.filter((p) => p.decision === d).length;
  const reviewedByMe = active.filter((p) => p.myScore !== null && p.speakerId !== user.id).length;
  const unpublished = active.filter((p) => p.decision !== "UNDECIDED" && !p.decisionPublished).length;
  const state = cfpState(event);
  const publicUrl = `${appUrl()}/events/${event.slug}`;
  const byTrack = event.tracks.map((t) => ({ track: t, n: active.filter((p) => p.track === t).length }));
  const maxTrack = Math.max(1, ...byTrack.map((t) => t.n));

  return (
    <div className="space-y-8">
      {guide && (guide.hidden ? <ShowGuideLink eventId={eventId} /> : <SetupGuide eventId={eventId} guide={guide} />)}
      {canManage(role) && (
        <div id="cfp" className="scroll-mt-6">
        <Card title="Call for papers" description={state === "draft" ? "Only your team can see this event until you publish." : "Speakers can find this CfP on SpeakerDesk and at the link below."}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm">
              {state === "draft" && <p>Draft: {event.cfpClosesAt ? `set to close ${formatDate(event.cfpClosesAt)}` : "no closing date set"}.</p>}
              {state === "upcoming" && <p>Published: opens {formatDate(event.cfpOpensAt)}.</p>}
              {state === "open" && <p>Accepting proposals{event.cfpClosesAt ? ` until ${formatDate(event.cfpClosesAt)}` : ""}.</p>}
              {state === "closed" && <p>Closed on {formatDate(event.cfpClosesAt)}.</p>}
              {state !== "draft" && <code className="mt-2 inline-block break-all rounded bg-neutral-100 px-2 py-1 text-xs">{publicUrl}</code>}
            </div>
            <ActionButton action={setCfpPublished.bind(null, event.id, !event.cfpPublished)} variant={event.cfpPublished ? "secondary" : "accent"}>
              {event.cfpPublished ? "Unpublish CfP" : "Publish CfP"}
            </ActionButton>
          </div>
          <p className="mt-4 text-sm">
            <Link href={`/organize/${event.id}/program#invite`} className="font-medium underline">Invite a speaker directly</Link>
            <span className="text-ink-soft">: find someone in the speaker directory and invite them to {event.name}.</span>
          </p>
          {(state === "open" || state === "upcoming") && (
            <ShareButtons
              title="Promote your call for papers"
              className="mt-5 border-t border-line pt-4"
              url={publicUrl}
              text={`Call for papers ${state === "open" ? "open" : `opens ${formatDate(event.cfpOpensAt)}`}: ${event.name}${event.cfpClosesAt ? `, submit by ${formatDate(event.cfpClosesAt)}` : ""}`}
              subject={`Speak at ${event.name}`}
            />
          )}
        </Card>
        </div>
      )}

      <Card
        title="Runbook"
        description={h.total ? `${h.done} of ${h.total} tasks done${h.overdue ? ` · ${h.overdue} overdue` : ""}` : "Plan every task from venue booking to retrospective."}
        actions={<Link href={`/organize/${event.id}/runbook`} className="text-sm text-ink-soft hover:text-ink">Open runbook →</Link>}
      >
        {h.total ? (
          <div className="grid gap-6 md:grid-cols-[220px_1fr]">
            <div>
              <Badge className={HEALTH_STYLES[h.level]}>{HEALTH_LABELS[h.level]}</Badge>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{Math.round(h.pct * 100)}%</p>
              <div className="mt-2 h-1.5 rounded-full bg-neutral-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${h.pct * 100}%` }} /></div>
            </div>
            <ul className="divide-y divide-line text-sm">
              {nextUp.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate">{t.title}</span>
                  <span className="shrink-0 text-xs text-ink-soft">{t.dueDate ? formatDate(t.dueDate) : "No date"} · {t.assignee?.name ?? "Unassigned"}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ButtonLink href={`/organize/${event.id}/runbook`} variant="secondary" size="sm">Set up the runbook</ButtonLink>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-6 rounded-xl border border-line bg-surface p-6 sm:grid-cols-4">
        <Stat label="Proposals" value={active.length} hint={proposals.length > active.length ? `${proposals.length - active.length} withdrawn` : undefined} />
        <Stat label="You reviewed" value={`${reviewedByMe}/${active.filter((p) => p.speakerId !== user.id).length}`} />
        <Stat label="Accepted" value={count("ACCEPTED")} hint={`${count("WAITLISTED")} waitlisted`} />
        <Stat label="Undecided" value={count("UNDECIDED")} hint={`${count("REJECTED")} rejected`} />
      </div>

      {canManage(role) && unpublished > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-brand-200 bg-brand-50 px-5 py-4">
          <div>
            <p className="font-medium text-brand-700">{unpublished} decision{unpublished === 1 ? "" : "s"} not yet sent to speakers</p>
            <p className="text-sm text-ink-soft">Speakers see their result in their tracker{event.decisionEmailsEnabled ? " and by email" : ""} once you publish. Undecided proposals stay pending. <Link href={`/organize/${event.id}/settings`} className="underline">Edit the emails</Link></p>
          </div>
          <ActionButton action={publishDecisions.bind(null, event.id)} variant="accent" confirmText={`Send ${unpublished} decision(s) to speakers now?${event.decisionEmailsEnabled ? " Each speaker also gets an email." : ""}`}>
            Publish decisions
          </ActionButton>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Needs your review" actions={<Link href={`/organize/${event.id}/proposals`} className="text-sm text-ink-soft hover:text-ink">All proposals →</Link>}>
          {(() => {
            const todo = active.filter((p) => p.myScore === null && p.speakerId !== user.id).slice(0, 6);
            if (!todo.length) return <p className="text-sm text-ink-soft">{active.length ? "You've reviewed everything. Nice." : "No proposals yet."}</p>;
            return (
              <ul className="divide-y divide-line">
                {todo.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/organize/${event.id}/proposals/${p.id}`} className="min-w-0 truncate text-sm font-medium hover:text-brand-700">{p.title}</Link>
                    <DecisionBadge decision={p.decision} />
                  </li>
                ))}
              </ul>
            );
          })()}
        </Card>
        <Card title="Proposals by track">
          {byTrack.length ? (
            <ul className="space-y-3">
              {byTrack.map(({ track, n }) => (
                <li key={track}>
                  <div className="flex justify-between text-sm"><span>{track}</span><span className="tabular-nums text-ink-soft">{n}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-neutral-100"><div className="h-full rounded-full bg-ink" style={{ width: `${(n / maxTrack) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">No tracks configured. <ButtonLink href={`/organize/${event.id}/settings`} variant="ghost" size="sm">Add tracks</ButtonLink></p>
          )}
        </Card>
      </div>
    </div>
  );
}
