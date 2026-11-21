import type { Metadata } from "next";
import { Suspense } from "react";
import { EventCfpForm } from "@/components/organizer/event-form";
import { Skeleton } from "@/components/ui";
import { updateEventSection } from "@/lib/actions/events";
import { requireEventAccess } from "@/lib/organizer";
import { StepHeader } from "../step-header";
import { eventFormValues } from "../values";

export const metadata: Metadata = { title: "Call for papers settings" };

type Props = PageProps<"/organize/[eventId]/settings/cfp">;

export default function CfpPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={5} />}>
      <Cfp params={props.params} />
    </Suspense>
  );
}

async function Cfp({ params }: { params: Props["params"] }) {
  const { eventId } = await params;
  const { event } = await requireEventAccess(eventId, "ORGANIZER");
  return (
    <>
      <StepHeader step="cfp" note={<p className="mt-2 text-sm text-ink-soft">Not running a call for papers? Skip this step: nothing is public until you publish the CfP on the Overview.</p>} />
      <EventCfpForm values={eventFormValues(event)} action={updateEventSection.bind(null, eventId, "cfp")} />
    </>
  );
}
