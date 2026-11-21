import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DecisionSelect } from "@/components/organizer/controls";
import { Badge, cx, DecisionBadge, EmptyState, FormatBadge, Skeleton } from "@/components/ui";
import { DECISIONS, type Decision } from "@/lib/domain";
import { requireEventAccess } from "@/lib/organizer";
import { canManage } from "@/lib/permissions";
import { getEventProposals, hideSpeaker } from "@/lib/proposal-queries";

export const metadata: Metadata = { title: "Proposals" };

type Props = PageProps<"/organize/[eventId]/proposals">;

export default function ProposalsPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={5} />}>
      <ProposalTable params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

function Score({ value }: { value: number | null }) {
  if (value === null) return <span className="text-neutral-400">-</span>;
  return <span className="font-display tracking-tight text-lg tabular-nums">{value.toFixed(1)}</span>;
}

async function ProposalTable({ params, searchParams }: { params: Props["params"]; searchParams: Props["searchParams"] }) {
  const { eventId } = await params;
  const sp = await searchParams;
  const { user, event, role } = await requireEventAccess(eventId);
  const anonymous = hideSpeaker(event, role);
  const decision = DECISIONS.includes(sp.decision as Decision) ? (sp.decision as Decision) : undefined;
  const track = typeof sp.track === "string" && event.tracks.includes(sp.track) ? sp.track : undefined;
  const sort = sp.sort === "newest" ? "newest" : "score";

  let rows = (await getEventProposals(eventId, user.id)).filter((p) => !p.withdrawn);
  if (decision) rows = rows.filter((p) => p.decision === decision);
  if (track) rows = rows.filter((p) => p.track === track);
  if (sort === "score") rows.sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));

  const href = (next: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { decision, track, sort, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/organize/${eventId}/proposals?${q}`;
  };
  const pill = (active: boolean) => cx("rounded px-2.5 py-1 text-sm", active ? "bg-ink text-paper" : "text-ink-soft hover:bg-neutral-200/60");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex flex-wrap gap-1">
          <Link href={href({ decision: undefined })} className={pill(!decision)}>All</Link>
          {DECISIONS.map((d) => (
            <Link key={d} href={href({ decision: d })} className={pill(decision === d)}>{{ UNDECIDED: "Undecided", ACCEPTED: "Accepted", WAITLISTED: "Waitlisted", REJECTED: "Rejected" }[d]}</Link>
          ))}
        </div>
        {event.tracks.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <Link href={href({ track: undefined })} className={pill(!track)}>All tracks</Link>
            {event.tracks.map((t) => <Link key={t} href={href({ track: t })} className={pill(track === t)}>{t}</Link>)}
          </div>
        )}
        <div className="ml-auto flex gap-1 text-sm">
          <Link href={href({ sort: "score" })} className={pill(sort === "score")}>Top rated</Link>
          <Link href={href({ sort: "newest" })} className={pill(sort === "newest")}>Newest</Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={decision || track ? "Nothing matches" : "No proposals yet"} photo="/images/events/audience.jpg">
          {decision || track ? "Try another filter." : "Share your public CfP link. Proposals appear here as speakers submit."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="stack-table min-w-full text-sm">
            <thead className="border-b border-line text-left text-xs text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">Proposal</th>
                <th className="px-4 py-3 font-medium">Track</th>
                <th className="px-4 py-3 text-right font-medium">Avg</th>
                <th className="px-4 py-3 text-right font-medium">Reviews</th>
                <th className="px-4 py-3 text-right font-medium">Mine</th>
                <th className="px-4 py-3 font-medium">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((p) => (
                <tr key={p.id} className="align-top hover:bg-neutral-50">
                  <td className="max-w-md px-4 py-3">
                    <Link href={`/organize/${eventId}/proposals/${p.id}`} className="font-medium hover:text-brand-700">{p.title}</Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                      <FormatBadge format={p.format} />
                      <span>{p.durationMinutes} min</span>
                      <span>· {anonymous ? "Anonymous speaker" : p.speakerName}</span>
                      {p.speakerId === user.id && <Badge>You</Badge>}
                      {p.invited && <Badge className="bg-brand-50 text-brand-700 ring-brand-200">Invited</Badge>}
                    </div>
                  </td>
                  <td data-label="Track" className="px-4 py-3 text-ink-soft"><span>{p.track || "-"}</span></td>
                  <td data-label="Average" className="px-4 py-3 text-right"><Score value={p.avgScore} /></td>
                  <td data-label="Reviews" className="px-4 py-3 text-right tabular-nums text-ink-soft"><span>{p.reviewCount}</span></td>
                  <td data-label="Your score" className="px-4 py-3 text-right tabular-nums"><span>{p.myScore ?? <span className="text-neutral-400">-</span>}</span></td>
                  <td data-label="Decision" className="px-4 py-3">
                    {canManage(role) ? (
                      <div className="flex items-center gap-2">
                        <DecisionSelect key={`${p.id}-${p.decision}`} proposalId={p.id} decision={p.decision} />
                        {p.decision !== "UNDECIDED" && !p.decisionPublished && <span className="text-[11px] text-brand-700">unsent</span>}
                      </div>
                    ) : (
                      <DecisionBadge decision={p.decision} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
