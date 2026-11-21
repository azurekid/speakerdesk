// iCalendar (RFC 5545) files: the event, its sessions, and a speaker's own speaking calendar.

import { SITE_URL } from "@/lib/site";

export type IcsEvent = {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  url?: string;
  /** Timed: real instants. All-day: UTC-midnight dates, end inclusive. */
  start: Date;
  end: Date;
  allDay?: boolean;
};

const UID_DOMAIN = new URL(SITE_URL).host;

/** Text values escape backslash, semicolon, comma and newlines. */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dateStamp = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

/** Lines longer than 75 octets are folded: CRLF plus a space, never splitting a character. */
function fold(line: string) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function buildCalendar(name: string, events: IcsEvent[]) {
  const now = utcStamp(new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SpeakerDesk//Schedule//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(name)}`];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}@${UID_DOMAIN}`, `DTSTAMP:${now}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(e.start)}`, `DTEND;VALUE=DATE:${dateStamp(new Date(e.end.getTime() + 86_400_000))}`);
    } else {
      lines.push(`DTSTART:${utcStamp(e.start)}`, `DTEND:${utcStamp(e.end)}`);
    }
    lines.push(`SUMMARY:${esc(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function icsResponse(body: string, filename: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^a-z0-9._-]/gi, "-")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
