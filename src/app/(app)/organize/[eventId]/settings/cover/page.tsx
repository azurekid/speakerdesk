import type { Metadata } from "next";
import { Suspense } from "react";
import { EventCoverForm } from "@/components/organizer/event-form";
import { Skeleton } from "@/components/ui";
import { updateEventSection } from "@/lib/actions/events";
import { requireEventAccess } from "@/lib/organizer";
import { StepHeader } from "../step-header";
import { eventFormValues } from "../values";

export const metadata: Metadata = { title: "Banner" };

type Props = PageProps<"/organize/[eventId]/settings/cover">;

export default function CoverPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={5} />}>
      <Cover params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Cover({ params, searchParams }: { params: Props["params"]; searchParams: Props["searchParams"] }) {
  const { eventId } = await params;
  const { new: isNew } = await searchParams;
  const { event } = await requireEventAccess(eventId, "ORGANIZER");
  return (
    <>
      <StepHeader
        step="cover"
        note={isNew === "1" && (
          <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {event.name} is created as a draft. Only your team can see it. Work through the steps on the left, at your own pace: everything can be changed later.
          </p>
        )}
      />
      <EventCoverForm values={eventFormValues(event)} action={updateEventSection.bind(null, eventId, "cover")} />
    </>
  );
}
