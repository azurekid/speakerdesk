import "server-only";
import { prisma } from "@/lib/db";

/**
 * Field names and activity types as the MVP portal's speaking form labels them (taken from its
 * public app bundle; check against the live form). The portal has no import, so this CSV is for
 * copy and paste: one row per delivered talk, with anything still missing listed in the last column.
 */
export const MVP_HEADERS = [
  "Activity type", "Title", "Technology area", "Description", "Date", "Target audience",
  "In-person attendees", "Live stream views", "On-demand views", "URL", "Event", "Missing",
] as const;

const THIRD_PARTY = "Speaker/Presenter at Third-party event";
const MICROSOFT = "Speaker/Presenter at Microsoft event";

type Row = Record<(typeof MVP_HEADERS)[number], string>;

export async function mvpRows(userId: string): Promise<Row[]> {
  const subs = await prisma.submission.findMany({
    where: { userId, status: "ACCEPTED" },
    include: { talk: { select: { title: true, abstractShort: true, abstractLong: true } } },
    orderBy: { eventStart: "asc" },
  });
  const now = Date.now();
  return subs
    // Only talks that have happened: the portal reports past activities.
    .filter((s) => {
      const end = (s.eventEnd ?? s.eventStart)?.getTime();
      return end !== undefined && end <= now; // no date yet: not reportable
    })
    .map((s) => {
      const title = s.talk?.title || s.eventName;
      const description = (s.talk?.abstractLong || s.talk?.abstractShort || "").trim();
      const date = s.eventStart ? s.eventStart.toISOString().slice(0, 10) : "";
      const hasAudience = s.inPersonAttendees !== null || s.liveStreamViews !== null || s.onDemandViews !== null;
      const missing = [
        !s.mvpTechnologyArea && "technology area",
        !description && "description",
        !date && "date",
        !s.targetAudience && "target audience",
        !hasAudience && "audience numbers",
      ].filter(Boolean);
      return {
        "Activity type": s.microsoftEvent ? MICROSOFT : THIRD_PARTY,
        Title: title,
        "Technology area": s.mvpTechnologyArea,
        Description: description,
        Date: date,
        "Target audience": s.targetAudience,
        "In-person attendees": s.inPersonAttendees?.toString() ?? "",
        "Live stream views": s.liveStreamViews?.toString() ?? "",
        "On-demand views": s.onDemandViews?.toString() ?? "",
        URL: s.recordingUrl || s.eventUrl,
        Event: s.eventName,
        Missing: missing.join("; "),
      };
    });
}

/** RFC 4180 CSV. Cells starting with = + - @ are prefixed so spreadsheets don't run them as formulas. */
export function toCsv(rows: Row[]): string {
  const cell = (v: string) => {
    const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [MVP_HEADERS.map(cell).join(","), ...rows.map((r) => MVP_HEADERS.map((h) => cell(r[h])).join(","))].join("\r\n");
}
