import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionButton } from "@/components/form-controls";
import { PublicHeader } from "@/components/public-header";
import { formatDateRange, Skeleton } from "@/components/ui";
import { cancelOwnTicket } from "@/lib/actions/tickets";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Cancel your ticket", robots: { index: false, follow: false } };

type Props = PageProps<"/tickets/[code]/cancel">;

/**
 * Linked from the ticket email. Asks first: mail scanners open every link in a message, so a
 * link that cancelled straight away would cancel tickets nobody meant to cancel.
 */
export default function CancelTicketPage(props: Props) {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-md px-4 py-12">
        <Suspense fallback={<Skeleton rows={3} />}>
          <Cancel params={props.params} />
        </Suspense>
      </main>
    </div>
  );
}

async function Cancel({ params }: { params: Props["params"] }) {
  const { code } = await params;
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(code)) notFound();
  const reg = await prisma.registration.findUnique({ where: { code }, include: { event: { select: { name: true, slug: true, startDate: true, endDate: true } } } });
  if (!reg) notFound();
  const { event } = reg;
  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{reg.status === "CANCELLED" ? "Your ticket is cancelled" : "Cancel your ticket?"}</h1>
      <p className="mt-2 text-sm text-ink-soft">{event.name} · {formatDateRange(event.startDate, event.endDate)} · {reg.name}</p>
      {reg.status === "CANCELLED" ? (
        <p className="mt-4 text-sm">Thanks for letting the organizers know. Your place can now go to someone else. <Link href={`/events/${event.slug}`} className="underline">Event page</Link></p>
      ) : reg.checkedInAt ? (
        <p className="mt-4 text-sm">This ticket has already been used at the entrance, so it can&apos;t be cancelled.</p>
      ) : (
        <>
          <p className="mt-4 text-sm">Your place goes to someone else. You can register again later if there are places left.</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <ActionButton action={cancelOwnTicket.bind(null, code)} variant="danger">Yes, cancel my ticket</ActionButton>
            <Link href={`/tickets/${code}`} className="text-sm underline">Keep my ticket</Link>
          </div>
        </>
      )}
    </div>
  );
}
