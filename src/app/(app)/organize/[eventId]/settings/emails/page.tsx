import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmationEmailForm } from "@/components/organizer/event-form";
import { DecisionEmailsForm } from "@/components/organizer/decision-emails-form";
import { formatDateRange, Skeleton } from "@/components/ui";
import { updateEventSection } from "@/lib/actions/events";
import { parseDecisionEmails } from "@/lib/decision-email";
import { requireEventAccess } from "@/lib/organizer";
import { StepHeader } from "../step-header";
import { eventFormValues } from "../values";

export const metadata: Metadata = { title: "Emails" };

type Props = PageProps<"/organize/[eventId]/settings/emails">;

export default function EmailsPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={5} />}>
      <Emails params={props.params} />
    </Suspense>
  );
}

async function Emails({ params }: { params: Props["params"] }) {
  const { eventId } = await params;
  const { event } = await requireEventAccess(eventId, "ORGANIZER");
  return (
    <div className="space-y-8">
      <StepHeader step="emails" note={<p className="mt-2 text-sm text-ink-soft">The built-in texts work as they are. Change them only if you want your own words. Ticket emails are sent automatically with the QR code.</p>} />
      <div data-shot="decision-emails">
        <DecisionEmailsForm eventId={eventId} eventName={event.name} eventDates={formatDateRange(event.startDate, event.endDate)} enabled={event.decisionEmailsEnabled} templates={parseDecisionEmails(event.decisionEmails)} />
      </div>
      <ConfirmationEmailForm values={eventFormValues(event)} action={updateEventSection.bind(null, eventId, "emails")} />
    </div>
  );
}
