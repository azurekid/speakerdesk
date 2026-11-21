import { QrCode } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo, formatDateRange, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Door scanner", robots: { index: false, follow: false } };

/**
 * The door scanner for event teams. Sign in on the door phone, pick the event, scan. Any team
 * member (volunteers included) can use it; nothing else from the workspace is shown.
 */
export default function ScanIndexPage() {
  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-8">
      <Link href="/" className="mb-8 block"><Logo /></Link>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Door scanner</h1>
      <p className="mt-1 text-sm text-ink-soft">Pick the event you&apos;re checking people in for.</p>
      <Suspense fallback={<Skeleton rows={3} />}>
        <Events />
      </Suspense>
    </main>
  );
}

async function Events() {
  const user = await requireUser();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const memberships = await prisma.eventMember.findMany({
    where: { userId: user.id },
    include: { event: { select: { id: true, name: true, startDate: true, endDate: true, _count: { select: { registrations: { where: { status: "ACTIVE" } } } } } } },
  });
  // Upcoming and running events first, soonest first; past events after.
  const events = memberships
    .map((m) => m.event)
    .sort((a, b) => {
      const pastA = (a.endDate ?? a.startDate ?? today) < today;
      const pastB = (b.endDate ?? b.startDate ?? today) < today;
      if (pastA !== pastB) return pastA ? 1 : -1;
      return (a.startDate?.getTime() ?? Infinity) - (b.startDate?.getTime() ?? Infinity);
    });
  if (!events.length) {
    return <p className="mt-8 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">You&apos;re not on any event team yet. Ask the organizer to add you as a volunteer.</p>;
  }
  return (
    <ul className="mt-6 space-y-3">
      {events.map((e) => (
        <li key={e.id}>
          <Link href={`/scan/${e.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-4 hover:border-ink">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-ink text-paper"><QrCode className="size-6" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{e.name}</span>
              <span className="block text-sm text-ink-soft">{formatDateRange(e.startDate, e.endDate)} · {e._count.registrations} tickets</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
