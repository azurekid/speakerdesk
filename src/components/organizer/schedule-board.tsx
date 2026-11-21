"use client";

import { GripVertical, X } from "lucide-react";
import Link from "next/link";
import { startTransition, useMemo, useOptimistic, useRef, useState } from "react";
import { PlaceSessionForm } from "@/components/organizer/schedule-forms";
import { buttonClass, cx } from "@/components/ui";
import { deleteScheduleItem, moveScheduleItem, placeSession, unscheduleSession } from "@/lib/actions/schedule";
import { type Block, DEFAULT_DAY_END, DEFAULT_DAY_START, findConflicts, formatDayLabel, formatMinute, formatRange, SNAP_MINUTES } from "@/lib/schedule";

export type BoardSession = {
  id: string; title: string; speakerName: string; speakerId: string; track: string; durationMinutes: number;
  confirmation: "PENDING" | "CONFIRMED" | "DECLINED" | null; day: string | null; start: number | null; roomId: string | null;
};
export type BoardItem = { id: string; title: string; day: string; start: number; end: number; roomId: string | null };
type Room = { id: string; name: string; capacity: number | null };

const PX_PER_MIN = 1.6;
const GUTTER = 56; // px, the time column
const COL_MIN = 200; // px per room
const PAD = 10; // px above the first and below the last hour line, so their labels fit

/**
 * Side-by-side lanes for blocks that overlap in one column (like a calendar app), so a clash
 * stays visible instead of one block hiding the other. Returns lane and lane count per id.
 */
function layoutLanes(blocks: { id: string; start: number; end: number }[]) {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
  const result = new Map<string, { lane: number; lanes: number }>();
  let group: { id: string; lane: number }[] = [];
  let groupEnd = -1;
  let laneEnds: number[] = [];
  const flush = () => {
    const lanes = laneEnds.length || 1;
    for (const g of group) result.set(g.id, { lane: g.lane, lanes });
    group = [];
    laneEnds = [];
  };
  for (const b of sorted) {
    if (b.start >= groupEnd) { flush(); groupEnd = -1; }
    let lane = laneEnds.findIndex((end) => end <= b.start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(b.end); } else laneEnds[lane] = b.end;
    group.push({ id: b.id, lane });
    groupEnd = Math.max(groupEnd, b.end);
  }
  flush();
  return result;
}

const laneStyle = (l: { lane: number; lanes: number } | undefined) =>
  l && l.lanes > 1 ? { left: `calc(${(l.lane / l.lanes) * 100}% + 4px)`, width: `calc(${100 / l.lanes}% - 8px)`, right: "auto" } : {};

type Drag = { kind: "session" | "item"; id: string; grabMinutes: number };
type Move =
  | { kind: "session"; id: string; day: string | null; start: number | null; roomId: string | null }
  | { kind: "item"; id: string; day: string; start: number; roomId: string | null };

export function ScheduleBoard({ eventId, days, rooms, sessions, items }: { eventId: string; days: string[]; rooms: Room[]; sessions: BoardSession[]; items: BoardItem[] }) {
  const [day, setDay] = useState(days[0]);
  const [selected, setSelected] = useState<{ kind: "session" | "item"; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  // While dragging, blocks on the all-rooms layer must let drops through to the columns.
  const [dragging, setDragging] = useState(false);

  // Moves show immediately; the server's answer (with revalidation) replaces them.
  const [state, applyMove] = useOptimistic({ sessions, items }, (cur, m: Move) =>
    m.kind === "session"
      ? { ...cur, sessions: cur.sessions.map((s) => (s.id === m.id ? { ...s, day: m.day, start: m.start, roomId: m.roomId } : s)) }
      : { ...cur, items: cur.items.map((i) => (i.id === m.id ? { ...i, day: m.day, end: m.start + (i.end - i.start), start: m.start, roomId: i.roomId === null ? null : m.roomId } : i)) },
  );

  const placed = state.sessions.filter((s) => s.day && s.start !== null);
  const unplaced = state.sessions.filter((s) => !s.day || s.start === null);
  const blocks: Block[] = useMemo(() => [
    ...placed.map((s) => ({ id: s.id, day: s.day!, start: s.start!, end: s.start! + s.durationMinutes, roomId: s.roomId, speakerId: s.speakerId, title: s.title })),
    ...state.items.map((i) => ({ id: i.id, day: i.day, start: i.start, end: i.end, roomId: i.roomId, title: i.title })),
  ], [placed, state.items]);
  const conflicts = useMemo(() => findConflicts(blocks), [blocks]);

  const today = blocks.filter((b) => b.day === day);
  const dayStart = Math.min(DEFAULT_DAY_START, ...today.map((b) => Math.floor(b.start / 60) * 60));
  const dayEnd = Math.max(DEFAULT_DAY_END, ...today.map((b) => Math.ceil(b.end / 60) * 60));
  const height = (dayEnd - dayStart) * PX_PER_MIN + 2 * PAD;
  const y = (minute: number) => PAD + (minute - dayStart) * PX_PER_MIN;
  const hours = Array.from({ length: (dayEnd - dayStart) / 60 + 1 }, (_, i) => dayStart + i * 60);

  function run(move: Move, call: () => Promise<{ ok: boolean; message?: string } | void>) {
    setError(null);
    startTransition(async () => {
      applyMove(move);
      const r = await call();
      if (r && !r.ok) setError(r.message ?? "That didn't work.");
    });
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>, roomId: string) {
    e.preventDefault();
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = dayStart + (e.clientY - rect.top - PAD) / PX_PER_MIN - d.grabMinutes;
    const start = Math.max(0, Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES);
    if (d.kind === "session") run({ kind: "session", id: d.id, day, start, roomId }, () => placeSession(eventId, d.id, day, start, roomId));
    else run({ kind: "item", id: d.id, day, start, roomId }, () => moveScheduleItem(eventId, d.id, day, start, roomId));
  }

  function startDrag(e: React.DragEvent<HTMLElement>, kind: Drag["kind"], id: string, fromGrid: boolean) {
    const rect = e.currentTarget.getBoundingClientRect();
    // Keep the block under the pointer where it was grabbed (tray cards snap by their top).
    drag.current = { kind, id, grabMinutes: fromGrid ? (e.clientY - rect.top) / PX_PER_MIN : 0 };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    setTimeout(() => setDragging(true), 0); // after the browser has taken its drag image
  }
  const endDrag = () => setDragging(false);

  const sel = selected?.kind === "session" ? state.sessions.find((s) => s.id === selected.id) : null;
  const selItem = selected?.kind === "item" ? state.items.find((i) => i.id === selected.id) : null;
  const roomName = (id: string | null) => rooms.find((r) => r.id === id)?.name ?? "All rooms";

  return (
    <div className="space-y-4">
      {days.length > 1 && (
        <div role="tablist" className="flex gap-1 overflow-x-auto rounded-lg bg-neutral-100 p-1 text-sm">
          {days.map((d) => (
            <button key={d} type="button" role="tab" aria-selected={d === day} onClick={() => setDay(d)} className={cx("min-h-9 whitespace-nowrap rounded-md px-3", d === day ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-soft hover:text-ink")}>
              {formatDayLabel(d, "short")}
            </button>
          ))}
        </div>
      )}

      {conflicts.messages.length > 0 && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p className="font-medium">{conflicts.messages.length} clash{conflicts.messages.length === 1 ? "" : "es"} to sort out</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">{conflicts.messages.slice(0, 8).map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}
      {error && <p role="status" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        {/* The grid: one column per room, time running down. */}
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <div className="relative" style={{ minWidth: GUTTER + rooms.length * COL_MIN }}>
            <div className="sticky top-0 z-20 flex border-b border-line bg-surface text-sm font-medium">
              <div style={{ width: GUTTER }} className="shrink-0" />
              {rooms.map((r) => (
                <div key={r.id} className="min-w-0 flex-1 truncate border-l border-line px-3 py-2" style={{ minWidth: COL_MIN }}>
                  {r.name}{r.capacity ? <span className="ml-1 text-xs font-normal text-ink-soft">{r.capacity} seats</span> : null}
                </div>
              ))}
            </div>
            <div className="relative flex" style={{ height }}>
              <div style={{ width: GUTTER }} className="relative shrink-0 text-[11px] tabular-nums text-ink-soft">
                {hours.map((h) => <span key={h} className="absolute right-2 -translate-y-1/2" style={{ top: y(h) }}>{formatMinute(h)}</span>)}
              </div>
              {rooms.map((r) => {
                const colItems = state.items.filter((i) => i.day === day && i.roomId === r.id);
                const colSessions = placed.filter((s) => s.day === day && s.roomId === r.id);
                const lanes = layoutLanes([...colItems, ...colSessions.map((s) => ({ id: s.id, start: s.start!, end: s.start! + s.durationMinutes }))]);
                return (
                <div
                  key={r.id}
                  className="relative min-w-0 flex-1 border-l border-line"
                  style={{ minWidth: COL_MIN }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                  onDrop={(e) => onDrop(e, r.id)}
                >
                  {hours.map((h) => <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-line/70" style={{ top: y(h) }} />)}
                  {hours.slice(0, -1).map((h) => <div key={`${h}h`} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line/40" style={{ top: y(h + 30) }} />)}
                  {colItems.map((i) => (
                    <ItemBlock key={i.id} item={i} top={y(i.start)} lane={lanes.get(i.id)} clash={conflicts.ids.has(i.id)} active={selected?.id === i.id} onSelect={() => setSelected({ kind: "item", id: i.id })} onDragStart={(e) => startDrag(e, "item", i.id, true)} onDragEnd={endDrag} />
                  ))}
                  {colSessions.map((s) => (
                    <div
                      key={s.id}
                      draggable
                      onDragStart={(e) => startDrag(e, "session", s.id, true)}
                      onDragEnd={endDrag}
                      onClick={() => setSelected({ kind: "session", id: s.id })}
                      className={cx(
                        "absolute inset-x-1 z-10 cursor-grab overflow-hidden rounded-md border bg-brand-50 px-2 py-1 text-left text-xs active:cursor-grabbing",
                        conflicts.ids.has(s.id) ? "border-rose-500 ring-2 ring-rose-300" : "border-brand-200",
                        selected?.id === s.id && "ring-2 ring-ink",
                      )}
                      style={{ top: y(s.start!) + 1, height: s.durationMinutes * PX_PER_MIN - 2, ...laneStyle(lanes.get(s.id)) }}
                    >
                      <p className="tabular-nums text-[11px] text-brand-700">{formatRange(s.start!, s.start! + s.durationMinutes)}{s.confirmation === "PENDING" && " · unconfirmed"}</p>
                      <p className="font-medium leading-tight text-ink">{s.title}</p>
                      <p className="truncate text-ink-soft">{s.speakerName}</p>
                    </div>
                  ))}
                </div>
                );
              })}
              {/* Breaks across every room sit on top of all columns. */}
              <div className="pointer-events-none absolute inset-y-0 right-0" style={{ left: GUTTER }}>
                {state.items.filter((i) => i.day === day && i.roomId === null).map((i) => (
                  <ItemBlock key={i.id} item={i} top={y(i.start)} clash={conflicts.ids.has(i.id)} active={selected?.id === i.id} onSelect={() => setSelected({ kind: "item", id: i.id })} onDragStart={(e) => startDrag(e, "item", i.id, true)} onDragEnd={endDrag} passThrough={dragging} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Unscheduled sessions and the details of whatever is selected. */}
        <aside className="space-y-4">
          {(sel || selItem) && (
            <div className="rounded-xl border border-ink bg-surface p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{sel?.title ?? selItem?.title}</p>
                  <p className="text-xs text-ink-soft">
                    {sel ? `${sel.speakerName} · ${sel.durationMinutes} min${sel.track ? ` · ${sel.track}` : ""}` : selItem && `${formatDayLabel(selItem.day, "short")}, ${formatRange(selItem.start, selItem.end)} · ${roomName(selItem.roomId)}`}
                  </p>
                </div>
                <button type="button" onClick={() => setSelected(null)} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-md hover:bg-neutral-100"><X className="size-4" /></button>
              </div>
              {sel && (
                <>
                  <PlaceSessionForm key={`${sel.id}-${sel.day}-${sel.start}-${sel.roomId}`} eventId={eventId} proposalId={sel.id} days={days} rooms={rooms} day={sel.day} start={sel.start} roomId={sel.roomId} />
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    {sel.day && (
                      <button type="button" className="text-rose-700 underline" onClick={() => run({ kind: "session", id: sel.id, day: null, start: null, roomId: null }, () => unscheduleSession(eventId, sel.id))}>
                        Take off the schedule
                      </button>
                    )}
                    <Link href={`/organize/${eventId}/proposals/${sel.id}`} className="underline">Open proposal</Link>
                  </div>
                </>
              )}
              {selItem && (
                <button type="button" className={buttonClass("danger", "sm")} onClick={() => { setSelected(null); startTransition(() => deleteScheduleItem(eventId, selItem.id)); }}>
                  Remove from schedule
                </button>
              )}
            </div>
          )}

          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="font-medium">Not scheduled yet <span className="text-ink-soft">({unplaced.length})</span></p>
            <p className="mb-3 text-xs text-ink-soft">Drag a session onto the grid, or tap it to pick a time.</p>
            {unplaced.length === 0 ? (
              <p className="text-sm text-ink-soft">Every accepted session has a slot.</p>
            ) : (
              <ul className="space-y-2">
                {unplaced.map((s) => (
                  <li
                    key={s.id}
                    draggable
                    onDragStart={(e) => startDrag(e, "session", s.id, false)}
                    onDragEnd={endDrag}
                    onClick={() => setSelected({ kind: "session", id: s.id })}
                    className={cx("flex cursor-grab items-start gap-2 rounded-lg border px-2.5 py-2 text-sm active:cursor-grabbing", selected?.id === s.id ? "border-ink" : "border-line hover:border-ink-soft")}
                  >
                    <GripVertical className="mt-0.5 size-4 shrink-0 text-neutral-400" />
                    <span className="min-w-0">
                      <span className="block font-medium leading-tight">{s.title}</span>
                      <span className="block truncate text-xs text-ink-soft">{s.speakerName} · {s.durationMinutes} min{s.confirmation === "PENDING" ? " · unconfirmed" : ""}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ItemBlock({ item, top, lane, clash, active, onSelect, onDragStart, onDragEnd, passThrough }: {
  item: BoardItem; top: number; lane?: { lane: number; lanes: number }; clash: boolean; active: boolean; onSelect: () => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void; onDragEnd: () => void; passThrough?: boolean;
}) {
  return (
    <div
      draggable
      title={`${item.title}, ${formatRange(item.start, item.end)}`}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={cx(
        "absolute inset-x-1 z-10 flex cursor-grab items-center gap-2 overflow-hidden rounded-md border bg-neutral-100 px-2 text-xs text-ink-soft active:cursor-grabbing",
        passThrough ? "pointer-events-none opacity-60" : "pointer-events-auto",
        clash ? "border-rose-500 ring-2 ring-rose-300" : "border-line",
        active && "ring-2 ring-ink",
      )}
      style={{ top: top + 1, height: (item.end - item.start) * PX_PER_MIN - 2, ...laneStyle(lane) }}
    >
      <span className="truncate whitespace-nowrap font-medium text-ink">{item.title}</span>
      {!(lane && lane.lanes > 1) && <span className="shrink-0 whitespace-nowrap tabular-nums">{formatRange(item.start, item.end)}</span>}
    </div>
  );
}
