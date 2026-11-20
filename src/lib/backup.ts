import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PLATFORMS, SUBMISSION_STATUSES, TALK_FORMATS, TALK_LEVELS } from "@/lib/domain";

/** Versioned JSON backup format — used by both export and import. */
export const BACKUP_FORMAT = "speakerdesk";
export const BACKUP_VERSION = 1;

export async function buildBackup(userId: string) {
  const [profile, talks, submissions] = await Promise.all([
    prisma.speakerProfile.findUnique({ where: { userId } }),
    prisma.talk.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.submission.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);
  const strip = <T extends Record<string, unknown>>(o: T) => {
    const { userId: _u, ...rest } = o;
    return rest;
  };
  const { id: _pid, createdAt: _c, updatedAt: _up, ...profileFields } = profile ? strip(profile) : ({} as Record<string, unknown>);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profile: profile ? profileFields : null,
    talks: talks.map(strip),
    submissions: submissions.map(strip),
  };
}

const str = z.string().nullish().transform((v) => v ?? "");
const date = z.string().nullish().transform((v) => (v ? new Date(v) : null)).refine((d) => d === null || !Number.isNaN(d.getTime()));

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  profile: z.record(z.string(), z.unknown()).nullish(),
  talks: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().min(1),
        subtitle: str,
        abstractShort: str,
        abstractLong: str,
        outline: str,
        takeaways: z.array(z.string()).default([]),
        format: z.enum(TALK_FORMATS).catch("SESSION"),
        durationMinutes: z.number().int().catch(45),
        level: z.enum(TALK_LEVELS).catch("INTERMEDIATE"),
        primaryTrack: str,
        tags: z.array(z.string()).default([]),
        language: str,
        slidesUrl: str,
        videoUrl: str,
        customFields: z.record(z.string(), z.unknown()).nullish(),
      }),
    )
    .max(1000)
    .default([]),
  submissions: z
    .array(
      z.object({
        id: z.string(),
        talkId: z.string().nullish(),
        eventName: z.string().min(1),
        eventUrl: str,
        cfpUrl: str,
        platform: z.enum(PLATFORMS).catch("OTHER"),
        location: str,
        status: z.enum(SUBMISSION_STATUSES).catch("DRAFT"),
        cfpDeadline: date,
        eventStart: date,
        eventEnd: date,
        submittedAt: date,
        recordingUrl: str,
        notes: str,
        externalId: z.string().nullish(),
      }),
    )
    .max(5000)
    .default([]),
});
export type Backup = z.infer<typeof backupSchema>;
