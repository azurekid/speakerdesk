import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/form-controls";
import { RegistrationSettingsForm, TicketTypeForm } from "@/components/organizer/ticket-forms";
import { Badge, Card, Skeleton, toDateInput } from "@/components/ui";
import { deleteTicketType } from "@/lib/actions/tickets";
import { requireEventAccess } from "@/lib/organizer";
import { ticketAvailability } from "@/lib/tickets";
import { StepHeader } from "../step-header";

export const metadata: Metadata = { title: "Registration and tickets" };

type Props = PageProps<"/organize/[eventId]/settings/registration">;

export default function RegistrationPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={5} />}>
      <Registration params={props.params} />
    </Suspense>
  );
}

async function Registration({ params }: { params: Props["params"] }) {
  const { eventId } = await params;
  const { event } = await requireEventAccess(eventId, "ORGANIZER");
  const { types, total } = await ticketAvailability(eventId);
  return (
    <div className="space-y-8">
      <StepHeader
        step="registration"
        note={<p className="mt-2 text-sm text-ink-soft">Using Meetup or run.events for sign-ups? Keep them there and import the list on the <Link href={`/organize/${eventId}/tickets`} className="underline">Tickets tab</Link>: everyone gets a QR ticket for the door.</p>}
      />
      <Card title="Ticket types" description={types.length ? `${total} registered so far.` : "Without ticket types everyone gets one General admission ticket. Add types for different days, students, speakers or crew."}>
        {types.length > 0 && (
          <ul className="mb-6 divide-y divide-line">
            {types.map((t) => (
              <li key={t.id} className="py-3">
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{t.name}</span>
                      {t.priceLabel && <span className="text-ink-soft"> · {t.priceLabel}</span>}
                      <span className="block text-xs text-ink-soft">{t.taken} taken{t.capacity !== null ? ` of ${t.capacity}` : ""}{t.description && ` · ${t.description}`}</span>
                    </span>
                    {!t.published && <Badge>Organizers only</Badge>}
                    <span className="text-sm text-ink-soft underline group-open:hidden">Edit</span>
                  </summary>
                  <div className="mt-3 rounded-lg bg-neutral-50 p-4">
                    <TicketTypeForm eventId={eventId} type={t} />
                    {t.taken === 0 && (
                      <div className="mt-3"><ActionButton action={deleteTicketType.bind(null, t.id)} variant="ghost" confirmText={`Delete the ${t.name} ticket?`}>Delete this ticket type</ActionButton></div>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        <TicketTypeForm eventId={eventId} />
      </Card>
      <RegistrationSettingsForm
        eventId={eventId}
        values={{
          registrationOpen: event.registrationOpen,
          registrationCapacity: event.registrationCapacity?.toString() ?? "",
          registrationClosesAt: toDateInput(event.registrationClosesAt),
          registrationNote: event.registrationNote,
          sponsorSharingEnabled: event.sponsorSharingEnabled,
        }}
      />
    </div>
  );
}
