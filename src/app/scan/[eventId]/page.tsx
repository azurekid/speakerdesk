import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckIn } from "@/components/organizer/check-in";
import { prisma } from "@/lib/db";
import { requireEventAccess } from "@/lib/organizer";

export const metadata: Metadata = { title: "Scanning tickets", robots: { index: false, follow: false } };

type Props = PageProps<"/scan/[eventId]">;

/** Full-screen scanner for one event. Team members only (requireEventAccess). */
export default function ScanPage(props: Props) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <Scanner params={props.params} />
    </Suspense>
  );
}

async function Scanner({ params }: { params: Props["params"] }) {
  const { eventId } = await params;
  const { event } = await requireEventAccess(eventId, "VOLUNTEER");
  const regs = await prisma.registration.findMany({
    where: { eventId },
    select: { id: true, name: true, email: true, company: true, status: true, checkedInAt: true, ticketType: { select: { name: true } } },
    orderBy: { name: "asc" },
    take: 20000,
  });
  return (
    <CheckIn
      fullScreen
      eventId={eventId}
      eventName={event.name}
      attendees={regs.map((r) => ({ id: r.id, name: r.name, email: r.email, company: r.company, ticket: r.ticketType?.name ?? "General admission", checkedIn: Boolean(r.checkedInAt), cancelled: r.status === "CANCELLED" }))}
    />
  );
}
