import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge, ButtonLink, CfpBadge, CoverImage, EmptyState, formatDate, formatDateRange, PageHeader, Skeleton } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { cfpState, eventWhere } from "@/lib/domain";
import { ROLE_LABELS, ROLE_STYLES } from "@/lib/permissions";
import { HEALTH_LABELS, HEALTH_STYLES, isOverdue, startOfToday } from "@/lib/runbook";
import { getRunbook } from "@/lib/runbook-queries";

export const metadata: Metadata = { title: "My events" };

export default function OrganizePage() {
  return (
    <>
      <PageHeader
        eyebrow="Organizer"
        title="My events"
        description="Run your call for papers, review proposals with your team and build the programme."
        actions={<><ButtonLink href="/organize/people" variant="secondary">People</ButtonLink><ButtonLink href="/organize/new">New event</ButtonLink></>}
      />
      <Suspense fallback={<Skeleton rows={3} />}>
        <EventList />
      </Suspense>
    </>
  );
}

async function EventList() {
  const user = await requireUser();
  const memberships = await prisma.eventMember.findMany({
    where: { userId: user.id },
    include: { event: { include: { _count: { select: { proposals: { where: { withdrawn: false } } } } } } },
    orderBy: { createdAt: "desc" },
  });
  const runbooks = new Map(await Promise.all(memberships.map(async (m) => [m.event.id, await getRunbook(m.event.id)] as const)));
  const today = startOfToday();
  const myTasks = memberships
    .flatMap((m) => runbooks.get(m.event.id)!.tasks.filter((t) => t.assigneeId === user.id && t.effectiveStatus !== "DONE").map((t) => ({ ...t, eventName: m.event.name })))
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))
    .slice(0, 8);
  if (!memberships.length) {
    return (
      <EmptyState title="Organizing an event?" photo="/images/events/panel.jpg" action={<ButtonLink href="/organize/new">Create your first event</ButtonLink>}>
        Publish a call for papers, let speakers submit from their SpeakerDesk library, and review everything in one place.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-8">
    {myTasks.length > 0 && (
      <section>
        <h2 className="mb-3 text-xl font-semibold tracking-tight">My tasks</h2>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {myTasks.map((t) => {
            const late = isOverdue({ status: t.effectiveStatus, dueDate: t.dueDate }, today);
            return (
              <li key={t.id}>
                <Link href={`/organize/${t.eventId}/runbook?view=mine`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-neutral-50">
                  <span className="min-w-0"><span className="font-medium">{t.title}</span> <span className="text-ink-soft">· {t.eventName}</span></span>
                  <span className={late ? "shrink-0 text-xs font-medium text-rose-700" : "shrink-0 text-xs text-ink-soft"}>{t.dueDate ? formatDate(t.dueDate) : "No date"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    )}
    <ul className="space-y-4">
      {memberships.map(({ event, role }) => (
        <li key={event.id}>
          <Link href={`/organize/${event.id}`} className="group grid overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-ink/30 sm:grid-cols-[240px_1fr]">
            <div className="relative aspect-[16/9] bg-night sm:aspect-auto">
              <CoverImage src={event.coverImage} fit={event.coverFit} position={event.coverPosition} sizes="240px" />
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <CfpBadge state={cfpState(event)} />
                {runbooks.get(event.id)!.health.level !== "empty" && (
                  <Badge className={HEALTH_STYLES[runbooks.get(event.id)!.health.level]}>Runbook: {HEALTH_LABELS[runbooks.get(event.id)!.health.level].toLowerCase()}</Badge>
                )}
                {role !== "OWNER" && <Badge className={ROLE_STYLES[role]}>{ROLE_LABELS[role]}</Badge>}
              </div>
              <h2 className="mt-2 font-display tracking-tight text-2xl font-semibold group-hover:text-brand-700">{event.name}</h2>
              <p className="text-sm text-ink-soft">{formatDateRange(event.startDate, event.endDate)}{eventWhere(event) && ` · ${eventWhere(event)}`}</p>
              <p className="mt-3 text-sm">
                <span className="font-semibold">{event._count.proposals}</span> <span className="text-ink-soft">proposal{event._count.proposals === 1 ? "" : "s"}</span>
                {event.cfpClosesAt && <span className="text-ink-soft"> · CfP closes {formatDate(event.cfpClosesAt)}</span>}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
    </div>
  );
}
