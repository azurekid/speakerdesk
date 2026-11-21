import { CalendarPlus, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionButton } from "@/components/form-controls";
import { TicketCheckInButton } from "@/components/organizer/check-in";
import { PublicHeader } from "@/components/public-header";
import { formatDateRange, Skeleton } from "@/components/ui";
import { cancelOwnTicket, setOwnSponsorConsent } from "@/lib/actions/tickets";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { eventWhere } from "@/lib/domain";
import { eventAccessOrNull } from "@/lib/organizer";

// Tickets are personal: never indexed, never in previews.
export const metadata: Metadata = { title: "Your ticket", robots: { index: false, follow: false } };

type Props = PageProps<"/tickets/[code]">;

export default function TicketPage(props: Props) {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-md px-4 py-10">
        <Suspense fallback={<Skeleton rows={4} />}>
          <Ticket params={props.params} />
        </Suspense>
      </main>
    </div>
  );
}

async function Ticket({ params }: { params: Props["params"] }) {
  const { code } = await params;
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(code)) notFound();
  const reg = await prisma.registration.findUnique({ where: { code }, include: { event: true, ticketType: { select: { name: true } } } });
  if (!reg) notFound();
  const { event } = reg;
  const user = await getCurrentUser();
  const staff = user ? await eventAccessOrNull(user, event.id, "VOLUNTEER") : null;
  const cancelled = reg.status === "CANCELLED";
  const where = event.format === "ONLINE" ? `Online${event.onlinePlatform ? ` · ${event.onlinePlatform}` : ""}` : [event.venue, event.address || eventWhere(event)].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      <article className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="border-b border-dashed border-line px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-700">{reg.ticketType?.name ?? "General admission"}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">{event.name}</h1>
          <p className="mt-2 text-sm text-ink-soft">{formatDateRange(event.startDate, event.endDate)}</p>
          {where && <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-soft"><MapPin className="mt-0.5 size-4 shrink-0" />{where}</p>}
        </div>
        <div className="px-6 py-6 text-center">
          {cancelled ? (
            <p className="rounded-lg bg-rose-50 px-4 py-6 text-sm text-rose-800">This ticket was cancelled.{event.registrationOpen && <> You can <Link href={`/events/${event.slug}`} className="underline">register again</Link> if there are places left.</>}</p>
          ) : (
            <>
              {/* White frame: scanners need contrast, also in dark mode. */}
              {/* eslint-disable-next-line @next/next/no-img-element -- generated per ticket */}
              <img src={`/tickets/${code}/qr.png`} alt="Ticket QR code for the entrance" width={256} height={256} className="mx-auto rounded-xl bg-white p-3" />
              <p className="mt-4 text-lg font-medium">{reg.name}</p>
              {reg.checkedInAt ? (
                <p className="mt-1 text-sm text-emerald-800">Checked in {reg.checkedInAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: event.timezone })}</p>
              ) : (
                <p className="mt-1 text-sm text-ink-soft">Show this code at the entrance, on your phone or printed.</p>
              )}
            </>
          )}
        </div>
      </article>

      {staff && !cancelled && (
        <section className="rounded-2xl border border-ink bg-surface p-5">
          <p className="mb-3 text-sm font-medium">You&apos;re on the {event.name} team</p>
          <TicketCheckInButton eventId={event.id} registrationId={reg.id} checkedIn={Boolean(reg.checkedInAt)} />
        </section>
      )}

      {!cancelled && (event.sponsorSharingEnabled || reg.shareWithSponsors) && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-sm">
          <p className="min-w-0 flex-1">
            {reg.shareWithSponsors ? "The sponsors of this event may contact you (name, email, company, job title)." : "Sponsors of this event can't see your details."}
          </p>
          <ActionButton action={setOwnSponsorConsent.bind(null, code, !reg.shareWithSponsors)} variant="ghost">
            {reg.shareWithSponsors ? "Stop sharing" : "Allow sponsor contact"}
          </ActionButton>
        </section>
      )}

      {!cancelled && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          {event.startDate && <a href={`/events/${event.slug}/calendar.ics`} className="inline-flex items-center gap-1.5 underline"><CalendarPlus className="size-4" />Add to calendar</a>}
          <Link href={`/events/${event.slug}`} className="underline">Event page</Link>
          {!reg.checkedInAt && (
            <ActionButton action={cancelOwnTicket.bind(null, code)} variant="ghost" confirmText="Cancel your ticket? Your place goes to someone else.">Cancel my ticket</ActionButton>
          )}
        </div>
      )}
    </div>
  );
}
