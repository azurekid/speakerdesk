"use client";

import { useState } from "react";
import { SessionDetailModal, type SessionWithDetails } from "@/components/session-detail-modal";
import { LEVEL_LABELS, FORMAT_LABELS } from "@/lib/domain";
import { formatDayLabel, formatRange } from "@/lib/schedule";
import { cx } from "@/components/ui";

export interface AgendaRow {
  key: string;
  day: string;
  start: number;
  end: number;
  title: string;
  sub: string;
  room: string;
  sessionId?: string;
  session?: SessionWithDetails;
}

export function AgendaInteractive({
  days,
  rows,
  roomPosition,
  eventSlug,
  eventName,
}: {
  days: string[];
  rows: AgendaRow[];
  roomPosition: Map<string, number>;
  eventSlug: string;
  eventName: string;
}) {
  const [selectedSession, setSelectedSession] = useState<SessionWithDetails | null>(null);

  return (
    <>
      {days.map((day) => {
        const today = rows.filter((r) => r.day === day);
        if (!today.length) return null;
        const slots = [...new Set(today.map((r) => r.start))];
        return (
          <div key={day} className="mt-6">
            <h3 className="mb-2 text-sm font-semibold">{formatDayLabel(day)}</h3>
            <ol className="divide-y divide-line border-y border-line">
              {slots.map((start) => (
                <li key={start} className="grid gap-x-4 gap-y-2 py-3 sm:grid-cols-[7rem_1fr]">
                  <p className="text-sm tabular-nums text-ink-soft">{formatRange(start, Math.max(...today.filter((r) => r.start === start).map((r) => r.end)))}</p>
                  <ul className="grid gap-2 sm:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]">
                    {today
                      .filter((r) => r.start === start)
                      .sort((a, b) => (roomPosition.get(a.room) ?? 99) - (roomPosition.get(b.room) ?? 99))
                      .map((r) => (
                        <li
                          key={r.key}
                          className={cx(
                            "rounded-lg border border-line px-3 py-2",
                            r.sessionId ? "cursor-pointer hover:border-brand-600 hover:bg-brand-50 transition-colors" : "bg-neutral-100 text-ink-soft"
                          )}
                          onClick={() => r.sessionId && r.session && setSelectedSession(r.session)}
                          role={r.sessionId ? "button" : undefined}
                          tabIndex={r.sessionId ? 0 : undefined}
                          onKeyDown={(e) => r.sessionId && r.session && e.key === "Enter" && setSelectedSession(r.session)}
                        >
                          {r.room && <p className="text-[11px] font-medium uppercase tracking-wide text-brand-700">{r.room}</p>}
                          <p className={cx("font-medium leading-snug", r.sessionId && "text-brand-700")}>{r.title}</p>
                          {r.sub && <p className="text-xs text-ink-soft">{r.sub}</p>}
                          {r.end !== Math.max(...today.filter((x) => x.start === start).map((x) => x.end)) && (
                            <p className="text-[11px] tabular-nums text-ink-soft">until {formatRange(r.start, r.end).split("–")[1]}</p>
                          )}
                          {r.sessionId && (
                            <a href={`/events/${eventSlug}/calendar.ics?session=${r.sessionId}`} className="mt-1 inline-block text-[11px] text-ink-soft underline" onClick={(e) => e.stopPropagation()}>
                              Add to calendar
                            </a>
                          )}
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        );
      })}

      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          eventName={eventName}
          eventSlug={eventSlug}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </>
  );
}
