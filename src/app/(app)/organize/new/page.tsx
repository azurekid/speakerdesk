import type { Metadata } from "next";
import { EMPTY_EVENT, EventForm } from "@/components/organizer/event-form";
import { PageHeader } from "@/components/ui";
import { createEvent } from "@/lib/actions/events";

export const metadata: Metadata = { title: "New event" };

export default function NewEventPage() {
  return (
    <>
      <PageHeader eyebrow="Organizer" title="New event" description="You can save it as a draft — speakers only see it once you publish the call for papers." />
      <EventForm values={EMPTY_EVENT} action={createEvent} submitLabel="Create event" cancelHref="/organize" />
    </>
  );
}
