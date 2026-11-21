import type { Metadata } from "next";
import { Suspense } from "react";
import { EventDetailsForm } from "@/components/organizer/event-form";
import { Skeleton } from "@/components/ui";
import { updateEventSection } from "@/lib/actions/events";
import { requireEventAccess } from "@/lib/organizer";
import { StepHeader } from "./step-header";
import { eventFormValues } from "./values";

export const metadata: Metadata = { title: "Event details" };

type Props = PageProps<"/organize/[eventId]/settings">;

export default function DetailsPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={5} />}>
      <Details params={props.params} />
    </Suspense>
  );
}

async function Details({ params }: { params: Props["params"] }) {
  const { eventId } = await params;
  const { event } = await requireEventAccess(eventId, "ORGANIZER");
  return (
    <>
      <StepHeader step="details" />
      <EventDetailsForm values={eventFormValues(event)} action={updateEventSection.bind(null, eventId, "details")} />
    </>
  );
}
