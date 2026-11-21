import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionButton } from "@/components/form-controls";
import { Card, Skeleton } from "@/components/ui";
import { deleteEvent } from "@/lib/actions/events";
import { requireEventAccess } from "@/lib/organizer";

export const metadata: Metadata = { title: "Delete event" };

type Props = PageProps<"/organize/[eventId]/settings/delete">;

export default function DeletePage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={2} />}>
      <Delete params={props.params} />
    </Suspense>
  );
}

async function Delete({ params }: { params: Props["params"] }) {
  const { eventId } = await params;
  const { event } = await requireEventAccess(eventId, "OWNER");
  return (
    <Card title="Delete event">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-ink-soft">Removes the event, its CfP, proposals, reviews, tickets, sponsors and runbook. Speakers keep their own tracker entries.</p>
        <ActionButton action={deleteEvent.bind(null, eventId)} variant="danger" confirmText={`Delete ${event.name} permanently?`}>Delete event</ActionButton>
      </div>
    </Card>
  );
}
