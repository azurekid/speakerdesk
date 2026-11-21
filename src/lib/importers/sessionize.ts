import "server-only";
import { guessDuration, guessFormat, guessLevel } from "@/lib/domain";
import type { ImportedProfile, ImportedTalk } from "./types";

/**
 * Sessionize public API ("API / Embed" endpoint configured by the organizer):
 *   https://sessionize.com/api/v2/{endpointId}/view/All
 * Returns sessions, speakers, categories and questions for one event.
 */

type SzLink = { title?: string; url?: string; linkType?: string };
type SzSpeaker = {
  id: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  bio?: string | null;
  tagLine?: string | null;
  profilePicture?: string | null;
  links?: SzLink[];
  sessions?: (string | number)[];
};
type SzSession = {
  id: string | number;
  title?: string;
  description?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  speakers?: (string | { id: string })[];
  categoryItems?: number[];
  questionAnswers?: { questionId: number; answerValue?: string | null }[];
  recordingUrl?: string | null;
  isServiceSession?: boolean;
  status?: string | null;
};
type SzCategory = { id: number; title?: string; items?: { id: number; name?: string }[] };
type SzQuestion = { id: number; question?: string };
type SzAll = { sessions?: SzSession[]; speakers?: SzSpeaker[]; categories?: SzCategory[]; questions?: SzQuestion[] };

export class SessionizeError extends Error {}

export function parseSessionizeId(input: string): string {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/sessionize\.com\/api\/v2\/([a-z0-9]+)/i)?.[1];
  const id = fromUrl ?? trimmed;
  if (!/^[a-z0-9]{4,32}$/i.test(id)) {
    throw new SessionizeError("Paste the Sessionize API URL (https://sessionize.com/api/v2/…/view/All) or its endpoint id.");
  }
  return id;
}

export async function fetchSessionize(endpointId: string): Promise<SzAll> {
  // Fixed host + validated id, so no SSRF surface here.
  const res = await fetch(`https://sessionize.com/api/v2/${endpointId}/view/All`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (res.status === 404) throw new SessionizeError("Sessionize endpoint not found. Is the API endpoint enabled for this event?");
  if (!res.ok) throw new SessionizeError(`Sessionize returned HTTP ${res.status}.`);
  const data = (await res.json()) as SzAll;
  if (!Array.isArray(data.sessions) || !Array.isArray(data.speakers)) {
    throw new SessionizeError("Unexpected response. Make sure the endpoint uses the “All” view in JSON format.");
  }
  return data;
}

const speakerIdOf = (s: string | { id: string }) => (typeof s === "string" ? s : s.id);

export function listSpeakers(data: SzAll) {
  return (data.speakers ?? [])
    .map((s) => ({
      id: s.id,
      name: s.fullName || [s.firstName, s.lastName].filter(Boolean).join(" ") || "Unnamed speaker",
      tagline: s.tagLine ?? "",
      sessionCount: (data.sessions ?? []).filter((x) => (x.speakers ?? []).map(speakerIdOf).includes(s.id)).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function mapSpeakerProfile(data: SzAll, speakerId: string): ImportedProfile {
  const s = (data.speakers ?? []).find((x) => x.id === speakerId);
  if (!s) return {};
  const profile: ImportedProfile = {
    fullName: s.fullName || [s.firstName, s.lastName].filter(Boolean).join(" "),
    tagline: s.tagLine ?? "",
    bioLong: s.bio ?? "",
    headshotSquareUrl: s.profilePicture ?? "",
  };
  for (const link of s.links ?? []) {
    const type = `${link.linkType ?? ""} ${link.title ?? ""}`.toLowerCase();
    const url = link.url ?? "";
    if (type.includes("linkedin")) profile.linkedinUrl ||= url;
    else if (type.includes("twitter") || /\bx\b/.test(type)) profile.xUrl ||= url;
    else if (type.includes("github")) profile.githubUrl ||= url;
    else if (type.includes("bluesky")) profile.blueskyUrl ||= url;
    else if (type.includes("mastodon")) profile.mastodonUrl ||= url;
    else if (type.includes("youtube")) profile.youtubeUrl ||= url;
    else if (type.includes("sessionize")) profile.sessionizeUrl ||= url;
    else if (type.includes("blog") || type.includes("website") || type.includes("company")) profile.websiteUrl ||= url;
  }
  return profile;
}

export function mapSpeakerTalks(data: SzAll, endpointId: string, speakerId: string, eventName: string): ImportedTalk[] {
  const categoryOf = new Map<number, { category: string; name: string }>();
  for (const c of data.categories ?? []) {
    for (const item of c.items ?? []) categoryOf.set(item.id, { category: (c.title ?? "").toLowerCase(), name: item.name ?? "" });
  }
  const questionTitle = new Map((data.questions ?? []).map((q) => [q.id, q.question ?? `Question ${q.id}`]));

  return (data.sessions ?? [])
    .filter((s) => !s.isServiceSession && (s.speakers ?? []).map(speakerIdOf).includes(speakerId))
    .map((s) => {
      const tags: string[] = [];
      let format, level, track, duration, language;
      for (const itemId of s.categoryItems ?? []) {
        const c = categoryOf.get(itemId);
        if (!c) continue;
        if (c.category.includes("format")) format ??= guessFormat(c.name);
        else if (c.category.includes("level")) level ??= guessLevel(c.name);
        else if (c.category.includes("track")) track ??= c.name;
        else if (c.category.includes("duration") || c.category.includes("length")) duration ??= guessDuration(c.name);
        else if (c.category.includes("language")) language ??= c.name;
        else tags.push(c.name);
        if (c.category.includes("topic") || c.category.includes("tag")) track ??= c.name;
      }
      if (!duration && s.startsAt && s.endsAt) {
        const mins = (new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / 60000;
        if (mins > 0 && mins <= 1440) duration = mins;
      }
      const answers = Object.fromEntries(
        (s.questionAnswers ?? []).filter((a) => a.answerValue).map((a) => [questionTitle.get(a.questionId) ?? String(a.questionId), a.answerValue]),
      );
      const id = String(s.id);
      return {
        ref: `${endpointId}:${id}`,
        title: s.title ?? "",
        abstractLong: s.description ?? "",
        format,
        level,
        durationMinutes: duration,
        primaryTrack: track,
        tags,
        language,
        videoUrl: s.recordingUrl ?? undefined,
        customFields: Object.keys(answers).length ? { sessionizeAnswers: answers } : undefined,
        submission: {
          externalId: `${endpointId}:${id}`,
          eventName,
          platform: "SESSIONIZE",
          // The public API only exposes sessions the organizer has published.
          status: !s.status || /accept/i.test(s.status) ? "ACCEPTED" : /declin|reject/i.test(s.status) ? "REJECTED" : "SUBMITTED",
          eventStart: s.startsAt ? new Date(s.startsAt) : null,
          eventEnd: s.endsAt ? new Date(s.endsAt) : null,
          recordingUrl: s.recordingUrl ?? undefined,
          platformData: { sessionizeEndpoint: endpointId, sessionId: id },
        },
      } satisfies ImportedTalk;
    });
}
