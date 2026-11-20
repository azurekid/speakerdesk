import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionButton } from "@/components/form-controls";
import { EventForm } from "@/components/organizer/event-form";
import { Card, Skeleton, toDateInput } from "@/components/ui";
import { deleteEvent, updateEvent } from "@/lib/actions/events";
import { requireEventAccess } from "@/lib/organizer";
import { canAdmin } from "@/lib/permissions";

export const metadata: Metadata = { title: "Event settings" };

type Props = PageProps<"/organize/[eventId]/settings">;

export default function SettingsPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={5} />}>
      <Settings params={props.params} />
    </Suspense>
  );
}

async function Settings({ params }: { params: Props["params"] }) {
  const { eventId } = await params;
  const { event, role } = await requireEventAccess(eventId, "ORGANIZER");
  const owner = canAdmin(role);

  return (
    <div className="space-y-8">
      <EventForm
        submitLabel="Save changes"
        cancelHref={`/organize/${eventId}`}
        action={updateEvent.bind(null, eventId)}
        values={{
          name: event.name, tagline: event.tagline, description: event.description, location: event.location, venue: event.venue,
          address: event.address, latitude: event.latitude, longitude: event.longitude,
          website: event.website, coverImage: event.coverImage, startDate: toDateInput(event.startDate), endDate: toDateInput(event.endDate),
          cfpOpensAt: toDateInput(event.cfpOpensAt), cfpClosesAt: toDateInput(event.cfpClosesAt), cfpGuidelines: event.cfpGuidelines,
          tracks: event.tracks, formats: event.formats, titleLimit: event.titleLimit?.toString() ?? "", abstractLimit: event.abstractLimit?.toString() ?? "",
          maxProposalsPerSpeaker: event.maxProposalsPerSpeaker, blindReview: event.blindReview,
        }}
      />
      {owner && (
        <Card title="Delete event">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">Removes the event, its CfP, proposals, reviews, sponsors and runbook. Speakers keep their own tracker entries.</p>
            <ActionButton action={deleteEvent.bind(null, eventId)} variant="danger" confirmText={`Delete ${event.name} permanently?`}>Delete event</ActionButton>
          </div>
        </Card>
      )}
    </div>
  );
}
