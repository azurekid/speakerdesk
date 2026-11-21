import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckIn } from "@/components/organizer/check-in";
import { Skeleton } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireEventAccess } from "@/lib/organizer";
import { canManage } from "@/lib/permissions";

export const metadata: Metadata = { title: "Check-in" };

type Props = PageProps<"/organize/[eventId]/tickets/check-in">;

export default function CheckInPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <Door params={props.params} />
    </Suspense>
  );
}

async function Door({ params }: { params: Props["params"] }) {
  const { eventId } = await params;
  const { role } = await requireEventAccess(eventId, "VOLUNTEER");
  const regs = await prisma.registration.findMany({
    where: { eventId },
    select: { id: true, name: true, email: true, company: true, status: true, checkedInAt: true, ticketType: { select: { name: true } } },
    orderBy: { name: "asc" },
    take: 20000,
  });
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {canManage(role) && <Link href={`/organize/${eventId}/tickets`} className="text-xs text-ink-soft hover:text-ink">← Attendees</Link>}
      <CheckIn
        eventId={eventId}
        attendees={regs.map((r) => ({ id: r.id, name: r.name, email: r.email, company: r.company, ticket: r.ticketType?.name ?? "General admission", checkedIn: Boolean(r.checkedInAt), cancelled: r.status === "CANCELLED" }))}
      />
      <p className="text-xs text-ink-soft">Tip: anyone on the event team can open this page on their phone. Attendees can also show their ticket page; scanning it with a team member&apos;s phone camera opens a check-in button.</p>
    </div>
  );
}
