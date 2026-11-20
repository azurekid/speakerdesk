import "server-only";
import { guessFormat } from "@/lib/domain";
import type { SubmissionStatus } from "@/lib/domain";
import { safeFetchJson, SafeFetchError } from "@/lib/safe-fetch";
import type { ImportedTalk } from "./types";

/**
 * Pretalx REST API (works with pretalx.com and self-hosted instances):
 *   GET {instance}/api/events/{event}/                 – event metadata
 *   GET {instance}/api/events/{event}/submissions/     – with an API token (all you can see)
 *   GET {instance}/api/events/{event}/talks/           – public, published schedule only (older API)
 * Handles both the legacy API shape (nested objects, localized strings) and the
 * newer one (ids unless `expand=` is used).
 */

export class PretalxError extends Error {}

type Localized = string | Record<string, string> | null | undefined;
type Named = { name?: Localized; code?: string } | string | number | null | undefined;
type PxSpeaker = { code?: string; name?: string } | string;
type PxSubmission = {
  code: string;
  title?: string;
  abstract?: string | null;
  description?: string | null;
  notes?: string | null;
  duration?: number | null;
  content_locale?: string | null;
  state?: string;
  submission_type?: Named;
  track?: Named;
  tags?: (string | { tag?: string })[];
  speakers?: PxSpeaker[];
  slot?: { start?: string | null; end?: string | null } | null;
  slots?: ({ start?: string | null; end?: string | null } | number)[];
};
type Page<T> = { next?: string | null; results?: T[] };
type PxEvent = { name?: Localized; slug?: string; date_from?: string | null; date_to?: string | null };

export type PretalxTarget = { instance: string; event: string };

function i18n(v: Localized): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v.en ?? Object.values(v)[0] ?? "";
}

function nameOf(v: Named): string {
  if (v == null || typeof v === "number") return "";
  if (typeof v === "string") return v;
  return i18n(v.name);
}

/** Accepts either an instance + slug, or a full event URL in the event field. */
export function parsePretalxTarget(instanceInput: string, eventInput: string): PretalxTarget {
  let instance = (instanceInput.trim() || "https://pretalx.com").replace(/\/+$/, "");
  let event = eventInput.trim();
  if (/^https?:\/\//i.test(event)) {
    const u = new URL(event);
    const segments = u.pathname.split("/").filter(Boolean);
    const apiIdx = segments.indexOf("events");
    instance = u.origin;
    event = segments[apiIdx >= 0 ? apiIdx + 1 : 0] ?? "";
  }
  if (!/^[\w-]{1,100}$/.test(event)) throw new PretalxError("Enter the event slug (e.g. “democon”) or the event URL.");
  return { instance, event };
}

async function getAll<T>(firstUrl: string, headers: Record<string, string>, origin: string): Promise<T[]> {
  const out: T[] = [];
  let url: string | null | undefined = firstUrl;
  for (let page = 0; url && page < 40; page++) {
    if (new URL(url).origin !== origin) throw new PretalxError("Pagination pointed to a different host.");
    const data: Page<T> = await safeFetchJson<Page<T>>(url, { headers });
    out.push(...(data.results ?? []));
    url = data.next;
  }
  return out;
}

export async function fetchPretalx(target: PretalxTarget, token: string) {
  const headers: Record<string, string> = token ? { Authorization: `Token ${token.trim()}` } : {};
  const api = `${target.instance}/api/events/${encodeURIComponent(target.event)}`;
  const origin = new URL(target.instance).origin;
  try {
    const event = await safeFetchJson<PxEvent>(`${api}/`, { headers });
    const expand = "expand=speakers,submission_type,track,tags,slots";
    let submissions: PxSubmission[];
    try {
      submissions = await getAll<PxSubmission>(`${api}/submissions/?${expand}`, headers, origin);
    } catch (err) {
      if (token) throw err;
      // Older instances only expose the published schedule publicly.
      submissions = await getAll<PxSubmission>(`${api}/talks/?${expand}`, headers, origin);
    }
    return { event, submissions };
  } catch (err) {
    if (err instanceof SafeFetchError || err instanceof PretalxError) throw new PretalxError(err.message);
    throw new PretalxError("Could not reach the Pretalx API.");
  }
}

function speakerKey(s: PxSpeaker): { code: string; name: string } {
  return typeof s === "string" ? { code: s, name: "" } : { code: s.code ?? "", name: s.name ?? "" };
}

export function listPretalxSpeakers(submissions: PxSubmission[]) {
  const map = new Map<string, { id: string; name: string; sessionCount: number }>();
  for (const sub of submissions) {
    for (const raw of sub.speakers ?? []) {
      const { code, name } = speakerKey(raw);
      const id = code || name;
      if (!id) continue;
      const entry = map.get(id) ?? { id, name: name || code, sessionCount: 0 };
      entry.sessionCount++;
      map.set(id, entry);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function mapState(state: string | undefined): SubmissionStatus {
  switch (state) {
    case "accepted":
    case "confirmed":
      return "ACCEPTED";
    case "rejected":
      return "REJECTED";
    case "withdrawn":
    case "canceled":
    case "deleted":
      return "WITHDRAWN";
    case "draft":
      return "DRAFT";
    default:
      return "SUBMITTED";
  }
}

export function mapPretalxTalks(
  target: PretalxTarget,
  event: PxEvent,
  submissions: PxSubmission[],
  speakerId: string,
): ImportedTalk[] {
  const eventName = i18n(event.name) || target.event;
  return submissions
    .filter((s) => (s.speakers ?? []).some((raw) => {
      const { code, name } = speakerKey(raw);
      return code === speakerId || (!code && name === speakerId);
    }))
    .map((s) => {
      const slot = s.slot ?? (s.slots ?? []).find((x): x is { start?: string; end?: string } => typeof x === "object");
      const type = nameOf(s.submission_type);
      const ref = `${target.instance}/${target.event}/${s.code}`;
      return {
        ref,
        title: s.title ?? "",
        abstractShort: s.abstract ?? "",
        abstractLong: s.description ?? "",
        format: guessFormat(type),
        durationMinutes: s.duration ?? undefined,
        primaryTrack: nameOf(s.track),
        tags: (s.tags ?? []).map((t) => (typeof t === "string" ? t : t.tag ?? "")).filter(Boolean),
        language: s.content_locale ?? undefined,
        customFields: type ? { pretalxSubmissionType: type } : undefined,
        submission: {
          externalId: ref,
          eventName,
          eventUrl: `${target.instance}/${target.event}/`,
          platform: "PRETALX",
          status: mapState(s.state),
          eventStart: slot?.start ? new Date(slot.start) : event.date_from ? new Date(event.date_from) : null,
          eventEnd: slot?.end ? new Date(slot.end) : event.date_to ? new Date(event.date_to) : null,
          platformData: { pretalxCode: s.code, state: s.state ?? null },
        },
      } satisfies ImportedTalk;
    });
}
