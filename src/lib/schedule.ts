// Client-safe schedule maths. Slot times are wall-clock minutes after midnight in the event's
// IANA time zone, and days are "YYYY-MM-DD" strings, so the grid never shifts with the
// viewer's own time zone. Conversion to real instants happens only for calendar files.

export const MAX_SCHEDULE_DAYS = 14;
export const DEFAULT_DAY_START = 8 * 60;
export const DEFAULT_DAY_END = 18 * 60;
export const SNAP_MINUTES = 5;

/** "YYYY-MM-DD" for a UTC-midnight date (how event dates and slot days are stored). */
export const dayKey = (d: Date) => d.toISOString().slice(0, 10);
export const dayFromKey = (key: string) => new Date(`${key}T00:00:00Z`);

/** Every day from the event's start to its end (inclusive), at most MAX_SCHEDULE_DAYS. */
export function eventDays(start: Date | null, end: Date | null): string[] {
  if (!start) return [];
  const last = end && end >= start ? end : start;
  const days: string[] = [];
  for (let t = start.getTime(); t <= last.getTime() && days.length < MAX_SCHEDULE_DAYS; t += 86_400_000) days.push(dayKey(new Date(t)));
  return days;
}

export const formatMinute = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const formatRange = (start: number, end: number) => `${formatMinute(start)}–${formatMinute(end)}`;

/** "09:30" → 570. Returns null for anything that isn't a valid time of day. */
export function parseTime(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

export function formatDayLabel(key: string, style: "long" | "short" = "long") {
  return new Intl.DateTimeFormat("en-GB", style === "long" ? { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" } : { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(dayFromKey(key));
}

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Offset of `tz` from UTC at `instant`, in milliseconds. */
function tzOffset(instant: number, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** The real instant of a wall-clock time on a day in a time zone (DST-aware). */
export function zonedInstant(day: string, minute: number, tz: string): Date {
  const wall = dayFromKey(day).getTime() + minute * 60_000;
  let guess = wall - tzOffset(wall, tz);
  guess = wall - tzOffset(guess, tz); // second pass settles DST transitions
  return new Date(guess);
}

/** A block on the schedule, sessions and breaks alike. roomId null = across every room. */
export type Block = { id: string; day: string; start: number; end: number; roomId: string | null; speakerId?: string; title: string };

const overlaps = (a: Block, b: Block) => a.day === b.day && a.start < b.end && b.start < a.end;

/**
 * Clashes worth warning about: two things in the same room at once, and a speaker booked in
 * two places at once. Returns a message per clash and the ids involved.
 */
export function findConflicts(blocks: Block[]) {
  const messages: string[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i];
      const b = blocks[j];
      if (!overlaps(a, b)) continue;
      const sameRoom = a.roomId === null || b.roomId === null || a.roomId === b.roomId;
      const sameSpeaker = Boolean(a.speakerId && a.speakerId === b.speakerId);
      if (!sameRoom && !sameSpeaker) continue;
      ids.add(a.id);
      ids.add(b.id);
      messages.push(`${sameSpeaker ? "Same speaker" : "Same room"}: “${a.title}” and “${b.title}” overlap on ${formatDayLabel(a.day, "short")}.`);
    }
  }
  return { messages, ids };
}

/** A stable description of a slot, to notice when a speaker's time or room changed. */
export const slotSignature = (s: { day: string; start: number; end: number; room: string }) => `${s.day} ${formatRange(s.start, s.end)} ${s.room}`;
