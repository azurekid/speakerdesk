import { ArrowDown, ArrowUp, CalendarPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/form-controls";
import { ScheduleBoard } from "@/components/organizer/schedule-board";
import { AddBreakForm, AddRoomForm, RenameRoomForm, TimezoneForm } from "@/components/organizer/schedule-forms";
import { ButtonLink, Card, EmptyState, Skeleton } from "@/components/ui";
import { deleteRoom, moveRoom, publishSchedule, sendScheduleUpdates } from "@/lib/actions/schedule";
import { requireEventAccess } from "@/lib/organizer";
import { findConflicts } from "@/lib/schedule";
import { getSchedule, slotsToAnnounce } from "@/lib/schedule-queries";

export const metadata: Metadata = { title: "Schedule" };

type Props = PageProps<"/organize/[eventId]/schedule">;

export default function SchedulePage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={6} />}>
      <Schedule params={props.params} />
    </Suspense>
  );
}

const TIME_ZONES = Intl.supportedValuesOf("timeZone");

async function Schedule({ params }: { params: Props["params"] }) {
  const { eventId } = await params;
  const { event } = await requireEventAccess(eventId, "ORGANIZER");
  const data = await getSchedule(eventId);
  const { days, rooms, sessions, items } = data;

  if (!days.length) {
    return (
      <EmptyState title="Set the event dates first" photo="/images/events/hall.jpg" action={<ButtonLink href={`/organize/${eventId}/settings`}>Open settings</ButtonLink>}>
        The schedule has a column per room and a tab per day, so it needs the event&apos;s start and end dates.
      </EmptyState>
    );
  }

  const placed = sessions.filter((s) => s.day).length;
  const conflicts = findConflicts([
    ...sessions.filter((s) => s.day).map((s) => ({ id: s.id, day: s.day!, start: s.start!, end: s.end!, roomId: s.roomId, speakerId: s.speakerId, title: s.title })),
    ...items.map((i) => ({ ...i })),
  ]).messages.length;
  const updates = event.schedulePublished ? (await slotsToAnnounce(eventId)).length : 0;
  const zones = TIME_ZONES.includes(event.timezone) ? TIME_ZONES : [event.timezone, ...TIME_ZONES];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface px-5 py-4">
        <div className="text-sm">
          <p>
            <span className="font-display text-2xl font-semibold tracking-tight">{placed}</span> of {sessions.length} accepted sessions scheduled
            {conflicts > 0 && <span className="text-rose-700"> · {conflicts} clash{conflicts === 1 ? "" : "es"}</span>}
          </p>
          <p className="text-ink-soft">
            {event.schedulePublished ? "Published on your event page." : "Only your team sees this until you publish."} Times in {event.timezone}.{" "}
            <a href={`/events/${event.slug}/calendar.ics`} className="inline-flex items-center gap-1 underline"><CalendarPlus className="size-3.5" />Calendar file</a>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {updates > 0 && (
            <ActionButton action={sendScheduleUpdates.bind(null, eventId)} variant="accent" confirmText={`Email ${updates} speaker(s) their new or changed time slot?`}>
              Send {updates} slot update{updates === 1 ? "" : "s"}
            </ActionButton>
          )}
          <ActionButton
            action={publishSchedule.bind(null, eventId, !event.schedulePublished)}
            variant={event.schedulePublished ? "secondary" : "accent"}
            confirmText={event.schedulePublished ? "Hide the schedule from the public event page?" : "Publish the schedule? It appears on your event page, and every scheduled speaker gets an email with their time slot."}
          >
            {event.schedulePublished ? "Unpublish schedule" : "Publish schedule"}
          </ActionButton>
        </div>
      </div>

      {rooms.length === 0 ? (
        <Card title="Add your rooms" description="Each room, stage or online channel gets its own column in the schedule.">
          <AddRoomForm eventId={eventId} first />
        </Card>
      ) : sessions.length === 0 && items.length === 0 ? (
        <EmptyState title="No accepted sessions yet" photo="/images/events/workshop.jpg">
          Accept proposals on the <Link href={`/organize/${eventId}/proposals`} className="underline">proposals list</Link>, then place them here. You can already add breaks below.
        </EmptyState>
      ) : null}

      {rooms.length > 0 && (
        <ScheduleBoard
          eventId={eventId}
          days={days}
          rooms={rooms}
          items={items}
          sessions={sessions.map((s) => ({ id: s.id, title: s.title, speakerName: s.speakerName, speakerId: s.speakerId, track: s.track, durationMinutes: s.durationMinutes, confirmation: s.confirmation, day: s.day, start: s.start, roomId: s.roomId }))}
        />
      )}

      {rooms.length > 0 && (
        <Card title="Breaks and plenary items" description="Registration, coffee, lunch, a welcome: anything that isn't a proposal. Across all rooms, or in one.">
          <AddBreakForm eventId={eventId} days={days} rooms={rooms} />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {rooms.length > 0 && (
          <Card title="Rooms" description="Removing a room takes its sessions off the schedule.">
            <ul className="mb-4 divide-y divide-line">
              {rooms.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                  <RenameRoomForm room={r} />
                  <div className="flex items-center">
                    <ActionButton action={moveRoom.bind(null, r.id, -1)} variant="ghost"><ArrowUp className="size-4" /><span className="sr-only">Move {r.name} left</span></ActionButton>
                    <ActionButton action={moveRoom.bind(null, r.id, 1)} variant="ghost"><ArrowDown className="size-4" /><span className="sr-only">Move {r.name} right</span></ActionButton>
                    <ActionButton action={deleteRoom.bind(null, r.id)} variant="ghost" confirmText={`Remove ${r.name}? Its sessions go back to "not scheduled".`}>Remove</ActionButton>
                  </div>
                </li>
              ))}
            </ul>
            <AddRoomForm eventId={eventId} first={false} />
          </Card>
        )}
        <Card title="Time zone">
          <TimezoneForm eventId={eventId} timezone={event.timezone} zones={zones} />
        </Card>
      </div>
    </div>
  );
}
