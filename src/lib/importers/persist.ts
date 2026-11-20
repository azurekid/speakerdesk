import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { isHttpUrl } from "@/lib/validation";
import type { ImportedProfile, ImportedSubmission, ImportedTalk, ImportSummary } from "./types";

const clip = (s: string | undefined | null, max: number) => (s ?? "").trim().slice(0, max);
const safeUrl = (s: string | undefined | null) => (s && isHttpUrl(s.trim()) ? s.trim().slice(0, 2000) : "");

/**
 * Writes imported talks (and their submissions) for one user.
 * - A talk is re-used when one with the same source ref, or the same title, already exists.
 * - A submission is skipped when one with the same platform + external id exists.
 */
export function emptySummary(): ImportSummary {
  return { talksCreated: 0, talksMatched: 0, submissionsCreated: 0, submissionsSkipped: 0, profileFieldsFilled: 0 };
}

export async function persistTalks(
  userId: string,
  source: string,
  items: ImportedTalk[],
  summary: ImportSummary = emptySummary(),
): Promise<{ summary: ImportSummary; talkIdByRef: Map<string, string> }> {
  const talkIdByRef = new Map<string, string>();

  const existing = await prisma.talk.findMany({ where: { userId }, select: { id: true, title: true, importSource: true, importRef: true } });
  const byRef = new Map(existing.filter((t) => t.importSource === source && t.importRef).map((t) => [t.importRef!, t.id]));
  const byTitle = new Map(existing.map((t) => [t.title.trim().toLowerCase(), t.id]));

  for (const item of items.slice(0, 500)) {
    const title = clip(item.title, 300);
    if (!title) continue;

    let talkId = byRef.get(item.ref) ?? byTitle.get(title.toLowerCase());
    if (talkId) {
      summary.talksMatched++;
    } else {
      const talk = await prisma.talk.create({
        data: {
          userId,
          title,
          subtitle: clip(item.subtitle, 300),
          abstractShort: clip(item.abstractShort, 5000),
          abstractLong: clip(item.abstractLong, 20000),
          outline: clip(item.outline, 50000),
          takeaways: (item.takeaways ?? []).map((t) => clip(t, 500)).filter(Boolean).slice(0, 10),
          format: item.format ?? "SESSION",
          level: item.level ?? "INTERMEDIATE",
          durationMinutes: item.durationMinutes && item.durationMinutes > 0 && item.durationMinutes <= 1440 ? Math.round(item.durationMinutes) : 45,
          primaryTrack: clip(item.primaryTrack, 120),
          tags: [...new Set((item.tags ?? []).map((t) => clip(t, 50).toLowerCase()).filter(Boolean))].slice(0, 30),
          language: clip(item.language, 20) || "en",
          slidesUrl: safeUrl(item.slidesUrl),
          videoUrl: safeUrl(item.videoUrl),
          customFields: item.customFields ? (item.customFields as Prisma.InputJsonValue) : undefined,
          importSource: source,
          importRef: item.ref,
        },
      });
      talkId = talk.id;
      byRef.set(item.ref, talkId);
      byTitle.set(title.toLowerCase(), talkId);
      summary.talksCreated++;
    }
    talkIdByRef.set(item.ref, talkId);

    if (item.submission) await persistSubmission(userId, talkId, item.submission, summary);
  }
  return { summary, talkIdByRef };
}

/** Creates a submission unless one with the same platform + external id is already tracked. */
export async function persistSubmission(
  userId: string,
  talkId: string | null,
  sub: ImportedSubmission,
  summary: ImportSummary,
): Promise<void> {
  const dupe = await prisma.submission.count({ where: { userId, platform: sub.platform, externalId: sub.externalId } });
  if (dupe) {
    summary.submissionsSkipped++;
    return;
  }
  await prisma.submission.create({
    data: {
      userId,
      talkId,
      eventName: clip(sub.eventName, 200) || "Imported event",
      eventUrl: safeUrl(sub.eventUrl),
      cfpUrl: safeUrl(sub.cfpUrl),
      platform: sub.platform,
      status: sub.status,
      cfpDeadline: sub.cfpDeadline ?? null,
      eventStart: sub.eventStart ?? null,
      eventEnd: sub.eventEnd ?? null,
      submittedAt: sub.submittedAt ?? null,
      location: clip(sub.location, 200),
      recordingUrl: safeUrl(sub.recordingUrl),
      notes: clip(sub.notes, 10000),
      externalId: sub.externalId,
      platformData: sub.platformData ? (sub.platformData as Prisma.InputJsonValue) : undefined,
    },
  });
  summary.submissionsCreated++;
}

/** Fills only the profile fields that are currently empty; never overwrites. */
export async function fillEmptyProfile(userId: string, incoming: ImportedProfile): Promise<number> {
  const profile = await prisma.speakerProfile.upsert({ where: { userId }, create: { userId }, update: {} });
  const data: Record<string, string> = {};
  for (const [key, raw] of Object.entries(incoming)) {
    if (!raw) continue;
    const current = (profile as Record<string, unknown>)[key];
    if (typeof current !== "string" || current.trim() !== "") continue;
    const value = key.endsWith("Url") ? safeUrl(raw) : clip(raw, key.startsWith("bio") ? 20000 : 2000);
    if (value) data[key] = value;
  }
  if (Object.keys(data).length) await prisma.speakerProfile.update({ where: { userId }, data });
  return Object.keys(data).length;
}
