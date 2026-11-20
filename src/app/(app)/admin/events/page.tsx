import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/form-controls";
import { Badge, CfpBadge, formatDate, Skeleton } from "@/components/ui";
import { adminDeleteEvent, adminJoinEvent, adminModerateEvent } from "@/lib/actions/admin";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/dal";
import { cfpState } from "@/lib/domain";

export const metadata: Metadata = { title: "Events · Admin" };

export default function AdminEventsPage() {
  return (
    <Suspense fallback={<Skeleton rows={5} />}>
      <Events />
    </Suspense>
  );
}

async function Events() {
  const admin = await requireAdmin();
  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      members: { where: { role: "OWNER" }, include: { user: { select: { id: true, name: true } } } },
      _count: { select: { proposals: true, sponsorships: true, members: true } },
    },
  });
  return (
    <div className="space-y-3">
      {events.map((e) => {
        const isMember = e.members.some((m) => m.userId === admin.id);
        return (
          <article key={e.id} className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CfpBadge state={cfpState(e)} />
                {e.sponsorshipOpen && <Badge>Sponsorship open</Badge>}
                {e.programPublished && <Badge>Programme public</Badge>}
              </div>
              <h3 className="mt-1 text-lg font-semibold">{e.name}</h3>
              <p className="text-xs text-ink-soft">
                Owners: {e.members.map((m) => <Link key={m.id} href={`/admin/users/${m.user.id}`} className="underline">{m.user.name}</Link>).reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, ", ", el] : [el]), [])} · {e._count.members} team · {e._count.proposals} proposals · {e._count.sponsorships} sponsor deals · created {formatDate(e.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(e.cfpPublished || e.programPublished) && <Link href={`/events/${e.slug}`} className="rounded-lg px-2.5 py-1.5 text-xs text-ink-soft hover:bg-neutral-100">Public page</Link>}
              {isMember ? (
                <Link href={`/organize/${e.id}`} className="rounded-lg px-2.5 py-1.5 text-xs text-ink-soft hover:bg-neutral-100">Workspace</Link>
              ) : (
                <ActionButton action={adminJoinEvent.bind(null, e.id)} variant="ghost" confirmText={`Add yourself as owner of ${e.name}? This is recorded in the audit log.`}>Join as owner</ActionButton>
              )}
              {e.cfpPublished && <ActionButton action={adminModerateEvent.bind(null, e.id, "unpublish-cfp")} variant="ghost" confirmText="Unpublish this CfP?">Unpublish CfP</ActionButton>}
              {e.sponsorshipOpen && <ActionButton action={adminModerateEvent.bind(null, e.id, "close-sponsorship")} variant="ghost" confirmText="Close sponsorship?">Close sponsorship</ActionButton>}
              <ActionButton action={adminDeleteEvent.bind(null, e.id)} variant="danger" confirmText={`Delete ${e.name} and everything in it?`}>Delete</ActionButton>
            </div>
          </article>
        );
      })}
    </div>
  );
}
