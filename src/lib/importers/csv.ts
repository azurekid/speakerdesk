import "server-only";
import Papa from "papaparse";
import {
  guessDuration, guessFormat, guessLevel, PLATFORMS, type Platform, SUBMISSION_STATUSES, type SubmissionStatus, TALK_FORMATS, type TalkFormat,
} from "@/lib/domain";
import type { ImportedTalk } from "./types";

/**
 * Generic CSV import (run.events exports, spreadsheets, our own CSV export).
 * Columns are matched case-insensitively against the aliases below.
 */
const ALIASES: Record<string, string[]> = {
  title: ["title", "session title", "talk title", "name"],
  subtitle: ["subtitle"],
  abstractShort: ["short abstract", "abstract short", "pitch", "elevator pitch", "summary", "abstractshort"],
  abstractLong: ["abstract", "description", "long abstract", "session description", "abstractlong"],
  outline: ["outline", "agenda", "notes for organizers", "details"],
  takeaways: ["takeaways", "key takeaways", "learning objectives", "learning outcomes"],
  format: ["format", "session format", "type", "session type"],
  duration: ["duration", "length", "duration (minutes)", "durationminutes"],
  level: ["level", "audience level", "difficulty"],
  track: ["track", "primary track", "category", "primarytrack"],
  tags: ["tags", "keywords", "topics"],
  language: ["language"],
  slidesUrl: ["slides", "slides url", "slidesurl"],
  videoUrl: ["video", "recording", "video url", "videourl"],
  event: ["event", "event name", "conference"],
  status: ["status", "submission status"],
  platform: ["platform"],
};

const splitList = (v: string, sep: RegExp) => v.split(sep).map((s) => s.replace(/^[-*•]\s*/, "").trim()).filter(Boolean);

export function parseTalksCsv(text: string): ImportedTalk[] {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase() });
  if (parsed.errors.length && !parsed.data.length) throw new Error(`Could not parse CSV: ${parsed.errors[0].message}`);

  const headers = parsed.meta.fields ?? [];
  const col: Record<string, string | undefined> = {};
  for (const [key, aliases] of Object.entries(ALIASES)) col[key] = headers.find((h) => aliases.includes(h));
  if (!col.title) throw new Error("The CSV needs a “title” column.");

  const get = (row: Record<string, string>, key: string) => (col[key] ? (row[col[key]!] ?? "").trim() : "");

  return parsed.data.slice(0, 500).map((row) => {
    const title = get(row, "title");
    const event = get(row, "event");
    const status = get(row, "status").toUpperCase() as SubmissionStatus;
    const platform = get(row, "platform").toUpperCase().replace(/[.\s]/g, "_") as Platform;
    const durationRaw = get(row, "duration");
    const formatRaw = get(row, "format");
    const formatUpper = formatRaw.toUpperCase().replace(/\s+/g, "_") as TalkFormat;
    return {
      ref: `csv:${title.toLowerCase()}`,
      title,
      subtitle: get(row, "subtitle"),
      abstractShort: get(row, "abstractShort"),
      abstractLong: get(row, "abstractLong"),
      outline: get(row, "outline"),
      takeaways: splitList(get(row, "takeaways"), /\r?\n|;/),
      format: TALK_FORMATS.includes(formatUpper) ? formatUpper : guessFormat(formatRaw),
      level: guessLevel(get(row, "level")),
      durationMinutes: Number(durationRaw) || guessDuration(durationRaw),
      primaryTrack: get(row, "track"),
      tags: splitList(get(row, "tags"), /[,;|]/),
      language: get(row, "language") || undefined,
      slidesUrl: get(row, "slidesUrl"),
      videoUrl: get(row, "videoUrl"),
      submission: event
        ? {
            externalId: `csv:${event.toLowerCase()}:${title.toLowerCase()}`,
            eventName: event,
            platform: PLATFORMS.includes(platform) ? platform : "OTHER",
            status: SUBMISSION_STATUSES.includes(status) ? status : "SUBMITTED",
          }
        : undefined,
    } satisfies ImportedTalk;
  });
}
