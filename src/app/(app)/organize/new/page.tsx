import type { Metadata } from "next";
import { EMPTY_EVENT, EventDetailsForm } from "@/components/organizer/event-form";
import { PageHeader } from "@/components/ui";
import { createEvent } from "@/lib/actions/events";
import { SETUP_STEPS } from "@/lib/event-setup";

export const metadata: Metadata = { title: "New event" };

export default function NewEventPage() {
  return (
    <>
      <PageHeader eyebrow="Organizer" title="New event" description="It starts as a draft that only you can see. Nothing is public until you publish the CfP or open registration." />
      <ol className="mb-6 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft" aria-label="Setup steps">
        {SETUP_STEPS.map((s, i) => (
          <li key={s.id} className={i === 0 ? "font-medium text-ink" : undefined}>{i + 1}. {s.label}</li>
        ))}
      </ol>
      <EventDetailsForm values={EMPTY_EVENT} action={createEvent} creating />
    </>
  );
}
