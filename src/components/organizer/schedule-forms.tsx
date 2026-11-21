"use client";

import { FormMessage, SubmitButton, useFormAction } from "@/components/form-controls";
import { Field } from "@/components/ui";
import { addRoom, addScheduleItem, placeSessionForm, renameRoom, setTimezone } from "@/lib/actions/schedule";
import { formatDayLabel, formatMinute } from "@/lib/schedule";

type Room = { id: string; name: string };

export function AddRoomForm({ eventId, first }: { eventId: string; first: boolean }) {
  const [state, onSubmit, pending] = useFormAction(addRoom.bind(null, eventId), undefined);
  return (
    <form onSubmit={onSubmit} key={state?.ok ? state.message : "form"} className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-40 flex-1">
          <span className="mb-1 block text-sm font-medium">{first ? "First room" : "Add a room"}</span>
          <input name="name" required maxLength={80} placeholder={first ? "Main stage" : "Room 2"} className="control" />
        </label>
        <label className="w-28">
          <span className="mb-1 block text-sm font-medium">Seats</span>
          <input name="capacity" type="number" min={0} inputMode="numeric" className="control" />
        </label>
        <SubmitButton pending={pending} variant="secondary">Add</SubmitButton>
      </div>
      {state && !state.ok && <FormMessage state={state} />}
    </form>
  );
}

export function RenameRoomForm({ room }: { room: Room }) {
  const [state, onSubmit, pending] = useFormAction(renameRoom.bind(null, room.id), undefined);
  return (
    <form onSubmit={onSubmit} className="flex min-w-0 flex-1 items-center gap-2">
      <input name="name" defaultValue={room.name} aria-label="Room name" required maxLength={80} className="control min-w-0 flex-1" />
      <SubmitButton pending={pending} variant="ghost" pendingLabel="…">Rename</SubmitButton>
      {state && !state.ok && <span className="text-xs text-rose-700">{state.message}</span>}
    </form>
  );
}

export function TimezoneForm({ eventId, timezone, zones }: { eventId: string; timezone: string; zones: string[] }) {
  const [state, onSubmit, pending] = useFormAction(setTimezone.bind(null, eventId), undefined);
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-48 flex-1">
          <span className="mb-1 block text-sm font-medium">Time zone</span>
          <select name="timezone" defaultValue={timezone} className="control">
            {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
          </select>
        </label>
        <SubmitButton pending={pending} variant="secondary">Save</SubmitButton>
      </div>
      <p className="text-xs text-ink-soft">Schedule times are local times at the event. Calendar downloads convert them for each attendee.</p>
      <FormMessage state={state} />
    </form>
  );
}

export function AddBreakForm({ eventId, days, rooms }: { eventId: string; days: string[]; rooms: Room[] }) {
  const [state, onSubmit, pending] = useFormAction(addScheduleItem.bind(null, eventId), undefined);
  const e = state?.errors;
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.4fr_1fr_1fr_1.4fr]">
        <Field label="What" htmlFor="item-title" error={e?.title}>
          <input id="item-title" name="title" required maxLength={120} placeholder="Lunch" className="control" />
        </Field>
        <Field label="Day" htmlFor="item-day">
          <select id="item-day" name="day" className="control">{days.map((d) => <option key={d} value={d}>{formatDayLabel(d, "short")}</option>)}</select>
        </Field>
        <Field label="From" htmlFor="item-start" error={e?.start}>
          <input id="item-start" name="start" type="time" step={300} required defaultValue="12:30" className="control" />
        </Field>
        <Field label="Until" htmlFor="item-end" error={e?.end}>
          <input id="item-end" name="end" type="time" step={300} required defaultValue="13:30" className="control" />
        </Field>
        <Field label="Where" htmlFor="item-room">
          <select id="item-room" name="roomId" className="control">
            <option value="">All rooms</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={pending} variant="secondary">Add to schedule</SubmitButton>
    </form>
  );
}

/** Place or move a session without drag and drop (phones, keyboards, precise times). */
export function PlaceSessionForm({ eventId, proposalId, days, rooms, day, start, roomId, onDone }: {
  eventId: string; proposalId: string; days: string[]; rooms: Room[]; day: string | null; start: number | null; roomId: string | null; onDone?: () => void;
}) {
  const [state, onSubmit, pending] = useFormAction(async (prev: Awaited<ReturnType<typeof placeSessionForm>> | undefined, form: FormData) => {
    const r = await placeSessionForm(eventId, proposalId, prev, form);
    if (r?.ok) onDone?.();
    return r;
  }, undefined);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Day" htmlFor={`day-${proposalId}`}>
          <select id={`day-${proposalId}`} name="day" defaultValue={day ?? days[0]} className="control">{days.map((d) => <option key={d} value={d}>{formatDayLabel(d, "short")}</option>)}</select>
        </Field>
        <Field label="Starts" htmlFor={`start-${proposalId}`} error={state?.errors?.start}>
          <input id={`start-${proposalId}`} name="start" type="time" step={300} required defaultValue={formatMinute(start ?? 9 * 60)} className="control" />
        </Field>
        <Field label="Room" htmlFor={`room-${proposalId}`}>
          <select id={`room-${proposalId}`} name="roomId" defaultValue={roomId ?? rooms[0]?.id} className="control">{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        </Field>
      </div>
      {state && !state.ok && <FormMessage state={state} />}
      <SubmitButton pending={pending}>{day ? "Move" : "Schedule"}</SubmitButton>
    </form>
  );
}
