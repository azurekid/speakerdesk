import { QrCode } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionButton } from "@/components/form-controls";
import { AddRegistrantForm, ImportRegistrants } from "@/components/organizer/ticket-forms";
import { Badge, ButtonLink, Card, cx, EmptyState, Skeleton } from "@/components/ui";
import { emailPendingTickets, resendTicket, setRegistrationCancelled, setSponsorExclusion } from "@/lib/actions/tickets";
import { prisma } from "@/lib/db";
import { requireEventAccess } from "@/lib/organizer";
import { canManage } from "@/lib/permissions";
import { registrationState, ticketAvailability } from "@/lib/tickets";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Tickets" };

type Props = PageProps<"/organize/[eventId]/tickets">;

const FILTERS = { all: "All", in: "Checked in", out: "Not checked in", sponsors: "Sponsor contact OK", cancelled: "Cancelled" } as const;
type Filter = keyof typeof FILTERS;
const SOURCE_LABELS = { SPEAKERDESK: "Event page", IMPORT: "Import", MANUAL: "Added by hand" } as const;

export default function TicketsPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={5} />}>
      <Tickets params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Tickets({ params, searchParams }: { params: Props["params"]; searchParams: Props["searchParams"] }) {
  const { eventId } = await params;
  const sp = await searchParams;
  const { event, role } = await requireEventAccess(eventId, "VOLUNTEER");
  // Door staff only need the check-in screen.
  if (!canManage(role)) redirect(`/organize/${eventId}/tickets/check-in`);

  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const filter: Filter = typeof sp.show === "string" && sp.show in FILTERS ? (sp.show as Filter) : "all";
  const where: Prisma.RegistrationWhereInput = {
    eventId,
    ...(filter === "cancelled" ? { status: "CANCELLED" } : { status: "ACTIVE" }),
    ...(filter === "in" ? { checkedInAt: { not: null } } : filter === "out" ? { checkedInAt: null } : {}),
    ...(filter === "sponsors" ? { shareWithSponsors: true } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { company: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [{ types, total }, list, matching, checkedIn, unsent, consented] = await Promise.all([
    ticketAvailability(eventId),
    prisma.registration.findMany({ where, include: { ticketType: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.registration.count({ where }),
    prisma.registration.count({ where: { eventId, status: "ACTIVE", checkedInAt: { not: null } } }),
    prisma.registration.count({ where: { eventId, status: "ACTIVE", ticketSentAt: null, NOT: { email: "" } } }),
    prisma.registration.count({ where: { eventId, status: "ACTIVE", shareWithSponsors: true, excludeFromSponsorExport: false } }),
  ]);
  const state = registrationState(event, total);
  const typeOptions = types.map((t) => ({ id: t.id, name: t.name, published: t.published }));
  const base = `/organize/${eventId}/tickets`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface px-5 py-4">
        <div className="text-sm">
          <p>
            <span className="font-display text-2xl font-semibold tracking-tight tabular-nums">{total}</span> registered
            {event.registrationCapacity !== null && <span className="text-ink-soft"> of {event.registrationCapacity}</span>}
            <span className="text-ink-soft"> · {checkedIn} checked in · {consented} OK with sponsor contact</span>
          </p>
          <p className="text-ink-soft">
            {{ open: "Registration is open on your event page.", "not-open": "Registration is closed to the public.", closed: "Registration has closed.", full: "Registration is full.", ended: "The event has ended." }[state]}{" "}
            <Link href={`/organize/${eventId}/settings/registration`} className="underline">Registration settings</Link>{" · "}
            <a href={`${base}/email-preview`} target="_blank" className="underline">Preview the ticket email</a>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unsent > 0 && (
            <ActionButton action={emailPendingTickets.bind(null, eventId)} variant="secondary" confirmText={`Email a QR ticket to ${unsent} people who haven't had one yet?`}>
              Email {unsent} ticket{unsent === 1 ? "" : "s"}
            </ActionButton>
          )}
          <ButtonLink href={`/scan/${eventId}`} variant="accent"><QrCode className="size-4" /> Door scanner</ButtonLink>
        </div>
      </div>

      {total === 0 && !event.registrationOpen && (
        <EmptyState title="No attendees yet" photo="/images/events/audience-question.jpg" action={<ButtonLink href={`/organize/${eventId}/settings/registration`}>Set up registration</ButtonLink>}>
          Open registration on your event page, or import the people who signed up on Meetup or run.events below.
        </EmptyState>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div data-shot="import-attendees">
        <Card title="Import from Meetup, run.events or a CSV" description="Upload the attendee export. You check which column is which before anything is saved.">
          <ImportRegistrants eventId={eventId} types={typeOptions} />
        </Card>
        </div>
        <Card title="Add someone" description="Speakers, crew, guests, or someone who signed up on paper.">
          <AddRegistrantForm eventId={eventId} types={typeOptions} />
        </Card>
      </div>

      <div data-shot="sponsor-export">
      <Card
        title="Export for sponsors"
        description="Only attendees who ticked “sponsors may contact me” when they registered, minus anyone you leave out in the list below. Imported attendees are never included: they weren't asked."
      >
        <form method="get" action={`${base}/sponsor-leads.csv`} className="space-y-3">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Columns</legend>
            <div className="flex flex-wrap gap-2 text-sm">
              {[["name", "Name", true], ["company", "Company", true], ["jobTitle", "Job title", true], ["email", "Email", true], ["ticket", "Ticket type", false]].map(([id, label, on]) => (
                <label key={id as string} className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-1.5 has-checked:border-ink">
                  <input type="checkbox" name="fields" value={id as string} defaultChecked={on as boolean} disabled={id === "name"} className="accent-ink" />
                  {label as string}
                </label>
              ))}
              <input type="hidden" name="fields" value="name" />
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="checkedIn" value="1" className="accent-ink" /> Only people who actually came (checked in)</label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="inline-flex min-h-10 items-center rounded-lg bg-ink px-4 text-sm font-medium text-paper" disabled={consented === 0}>Download sponsor list ({consented})</button>
            {!event.sponsorSharingEnabled && (
              <p className="text-xs text-ink-soft">Attendees aren&apos;t asked yet. Turn on the question in <Link href={`/organize/${eventId}/settings/registration`} className="underline">registration settings</Link>.</p>
            )}
          </div>
        </form>
      </Card>
      </div>

      <section data-shot="attendee-list">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Attendees</h2>
          <a href={`${base}/attendees.csv`} className="text-sm underline">Download everyone (CSV)</a>
        </div>
        <form method="get" className="mb-3 flex flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder="Search name, email or company" className="control max-w-xs" aria-label="Search attendees" />
          <input type="hidden" name="show" value={filter} />
          <button type="submit" className="inline-flex min-h-10 items-center rounded-lg border border-line px-3 text-sm">Search</button>
        </form>
        <nav className="mb-3 flex flex-wrap gap-1 text-sm" aria-label="Filter attendees">
          {(Object.keys(FILTERS) as Filter[]).map((f) => (
            <Link key={f} href={`${base}?show=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={cx("rounded-lg px-3 py-1.5", f === filter ? "bg-ink text-paper" : "text-ink-soft hover:bg-neutral-100")}>{FILTERS[f]}</Link>
          ))}
        </nav>
        {list.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">{q || filter !== "all" ? "Nobody matches." : "No attendees yet."}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="stack-table w-full text-left text-sm">
              <thead className="border-b border-line text-xs text-ink-soft">
                <tr><th className="px-4 py-2">Attendee</th><th className="px-4 py-2">Ticket</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Sponsors</th><th className="px-4 py-2"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((r) => (
                  <tr key={r.id} className={r.status === "CANCELLED" ? "opacity-60" : undefined}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-ink-soft">{[r.email || "no email", [r.jobTitle, r.company].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="px-4 py-3" data-label="Ticket">
                      {r.ticketType?.name ?? "General admission"}
                      <span className="block text-xs text-ink-soft">{SOURCE_LABELS[r.source]}{r.sourcePlatform && r.source === "IMPORT" ? ` (${r.sourcePlatform})` : ""}</span>
                    </td>
                    <td className="px-4 py-3" data-label="Status">
                      {r.status === "CANCELLED" ? <Badge className="bg-rose-50 text-rose-800 ring-rose-200">Cancelled</Badge>
                        : r.checkedInAt ? <Badge className="bg-emerald-50 text-emerald-800 ring-emerald-200">In · {r.checkedInAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: event.timezone })}</Badge>
                        : r.ticketSentAt ? <span className="text-ink-soft">Ticket sent</span>
                        : <span className="text-amber-800">{r.email ? "Ticket not sent" : "No email"}</span>}
                    </td>
                    <td className="px-4 py-3" data-label="Sponsors">
                      {!r.shareWithSponsors ? <span className="text-ink-soft">No</span> : (
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span className={r.excludeFromSponsorExport ? "text-ink-soft line-through" : ""}>Yes</span>
                          <ActionButton action={setSponsorExclusion.bind(null, r.id, !r.excludeFromSponsorExport)} variant="ghost">{r.excludeFromSponsorExport ? "Include" : "Leave out"}</ActionButton>
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex justify-end gap-1 max-md:justify-start">
                        {r.status === "ACTIVE" && r.email && <ActionButton action={resendTicket.bind(null, r.id)} variant="ghost">Resend</ActionButton>}
                        <ActionButton action={setRegistrationCancelled.bind(null, r.id, r.status === "ACTIVE")} variant="ghost" confirmText={r.status === "ACTIVE" ? `Cancel ${r.name}'s ticket?` : undefined}>
                          {r.status === "ACTIVE" ? "Cancel" : "Restore"}
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {matching > list.length && <p className="mt-2 text-xs text-ink-soft">Showing the newest {list.length} of {matching}. Search to find someone, or download the CSV.</p>}
      </section>
    </div>
  );
}
