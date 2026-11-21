import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BadgeMedal } from "@/components/badge-medal";
import { ActionButton } from "@/components/form-controls";
import { AwardBadgeForm, CreateBadgeForm } from "@/components/organizer/badge-controls";
import { Badge, Card, formatDate, Skeleton } from "@/components/ui";
import { archiveEventBadge, revokeBadgeAward } from "@/lib/actions/badges";
import { availableBadges, eligibleRecipients } from "@/lib/badge-queries";
import { prisma } from "@/lib/db";
import { requireEventAccess } from "@/lib/organizer";

export const metadata: Metadata = { title: "Badges" };

type Props = PageProps<"/organize/[eventId]/badges">;

const STATUS = {
  PENDING: { label: "Waiting for them", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  ACCEPTED: { label: "Accepted", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  DECLINED: { label: "Declined", cls: "bg-neutral-50 text-ink-soft ring-line" },
  REVOKED: { label: "Revoked", cls: "bg-rose-50 text-rose-800 ring-rose-200" },
} as const;

export default function BadgesPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={5} />}>
      <Badges params={props.params} />
    </Suspense>
  );
}

async function Badges({ params }: { params: Props["params"] }) {
  const { eventId } = await params;
  const { user, event } = await requireEventAccess(eventId, "ORGANIZER");
  const [badges, recipients, awards] = await Promise.all([
    availableBadges(eventId),
    eligibleRecipients(eventId, user.id),
    prisma.badgeAward.findMany({
      where: { eventId },
      include: { badge: true, recipient: { select: { name: true, profile: { select: { fullName: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const own = badges.filter((b) => b.eventId);

  return (
    <div className="space-y-6">
      <Card title="Award a badge" description="Recognise speakers and your team. They accept it first, then choose whether it shows on their public profile.">
        <AwardBadgeForm
          eventId={eventId}
          eventName={event.name} date={event.startDate?.toISOString() ?? null}
          badges={badges.map((b) => ({ id: b.id, name: b.name, description: b.description, icon: b.icon, color: b.color, platform: !b.eventId }))}
          recipients={recipients}
        />
      </Card>

      <Card title={`Given so far (${awards.length})`}>
        {awards.length === 0 ? (
          <p className="text-sm text-ink-soft">No badges awarded yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {awards.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                <BadgeMedal icon={a.badge.icon} color={a.badge.color} size="sm" muted={a.status === "REVOKED" || a.status === "DECLINED"} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.badge.name} <span className="font-normal text-ink-soft">→ {a.recipient.profile?.fullName || a.recipient.name}</span></p>
                  <p className="text-xs text-ink-soft">{formatDate(a.createdAt)}{a.message && ` · “${a.message}”`}</p>
                </div>
                {/* Phones: status and actions get their own line under the name. */}
                <div className="flex w-full items-center gap-3 pl-[52px] sm:w-auto sm:pl-0">
                  <Badge className={STATUS[a.status].cls}>{STATUS[a.status].label}</Badge>
                  {a.status === "ACCEPTED" && a.showOnProfile && <Link href={`/credentials/${a.id}`} className="text-xs text-ink-soft underline">View</Link>}
                  {(a.status === "PENDING" || a.status === "ACCEPTED") && (
                    <span className="ml-auto sm:ml-0">
                      <ActionButton action={revokeBadgeAward.bind(null, a.id)} variant="ghost" confirmText={`Revoke “${a.badge.name}” from ${a.recipient.profile?.fullName || a.recipient.name}?`}>Revoke</ActionButton>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Create a badge" description="Your own badge for this event — e.g. “Best demo” or “Hackathon winner”.">
          <CreateBadgeForm eventId={eventId} eventName={event.name} date={event.startDate?.toISOString() ?? null} />
        </Card>
        <Card title="Your event's badges">
          {own.length === 0 ? (
            <p className="text-sm text-ink-soft">None yet. The {badges.length} SpeakerDesk badges are always available.</p>
          ) : (
            <ul className="divide-y divide-line">
              {own.map((b) => (
                <li key={b.id} className="flex items-center gap-3 py-2.5">
                  <BadgeMedal icon={b.icon} color={b.color} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{b.name}</p>
                    {b.description && <p className="truncate text-xs text-ink-soft">{b.description}</p>}
                  </div>
                  <ActionButton action={archiveEventBadge.bind(null, b.id)} variant="ghost" confirmText={`Archive “${b.name}”? People who already have it keep it.`}>Archive</ActionButton>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
