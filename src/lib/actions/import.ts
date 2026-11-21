"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { backupSchema } from "@/lib/backup";
import { profileSchema } from "@/lib/validation";
import { parseTalksCsv } from "@/lib/importers/csv";
import { emptySummary, fillEmptyProfile, persistSubmission, persistTalks } from "@/lib/importers/persist";
import { fetchProfilePage, ProfilePageError } from "@/lib/importers/profile-page";
import { fetchPretalx, listPretalxSpeakers, mapPretalxTalks, parsePretalxTarget, PretalxError } from "@/lib/importers/pretalx";
import {
  fetchSessionize, listSpeakers, mapSpeakerProfile, mapSpeakerTalks, parseSessionizeId, SessionizeError,
} from "@/lib/importers/sessionize";
import type { ImportedTalk, ImportSummary } from "@/lib/importers/types";

export type SpeakerChoice = { id: string; name: string; tagline?: string; sessionCount: number };

export type LookupState =
  | undefined
  | { step: "pick"; speakers: SpeakerChoice[]; context: Record<string, string>; error?: undefined }
  | { step: "error"; error: string };

export type ImportResult = undefined | { ok: true; summary: ImportSummary; note?: string } | { ok: false; error: string };

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function done(summary: ImportSummary, note?: string): ImportResult {
  revalidatePath("/sessions");
  revalidatePath("/submissions");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  return { ok: true, summary, ...(note ? { note } : {}) };
}

function message(err: unknown, fallback: string) {
  if (err instanceof SessionizeError || err instanceof PretalxError || err instanceof ProfilePageError) return err.message;
  console.error(err);
  return fallback;
}

// ─── Sessionize ──────────────────────────────────────────────────────────────

export async function sessionizeLookup(_prev: LookupState, form: FormData): Promise<LookupState> {
  await requireUser();
  try {
    const endpointId = parseSessionizeId(String(form.get("endpoint") ?? ""));
    const data = await fetchSessionize(endpointId);
    const speakers = listSpeakers(data);
    if (!speakers.length) return { step: "error", error: "This endpoint has no speakers." };
    return { step: "pick", speakers, context: { endpointId, eventName: String(form.get("eventName") ?? "").trim() } };
  } catch (err) {
    return { step: "error", error: message(err, "Could not load the Sessionize endpoint.") };
  }
}

export async function sessionizeImport(_prev: ImportResult, form: FormData): Promise<ImportResult> {
  const user = await requireUser();
  try {
    const endpointId = parseSessionizeId(String(form.get("endpointId") ?? ""));
    const speakerId = String(form.get("speakerId") ?? "");
    if (!speakerId) return { ok: false, error: "Pick yourself from the speaker list." };
    const eventName = String(form.get("eventName") ?? "").trim() || `Sessionize event ${endpointId}`;
    const data = await fetchSessionize(endpointId);
    const { summary } = await persistTalks(user.id, "sessionize", mapSpeakerTalks(data, endpointId, speakerId, eventName));
    if (form.get("includeProfile") === "on") summary.profileFieldsFilled = await fillEmptyProfile(user.id, mapSpeakerProfile(data, speakerId));
    return done(summary);
  } catch (err) {
    return { ok: false, error: message(err, "Import from Sessionize failed.") };
  }
}

// ─── Public profile page (Sessionize / run.events) ───────────────────────────

export async function profilePageImport(_prev: ImportResult, form: FormData): Promise<ImportResult> {
  const user = await requireUser();
  try {
    const page = await fetchProfilePage(String(form.get("profileUrl") ?? ""));
    const source = page.source === "sessionize" ? "sessionize-profile" : "runevents-profile";
    const { summary } = await persistTalks(user.id, source, page.talks);
    if (form.get("includeProfile") === "on") {
      summary.profileFieldsFilled = await fillEmptyProfile(user.id, page.profile);
      // Topics feed the public speaker directory; only set them if the speaker has none yet.
      if (page.topics.length) {
        const current = await prisma.speakerProfile.findUnique({ where: { userId: user.id }, select: { topics: true } });
        if (current && current.topics.length === 0) {
          await prisma.speakerProfile.update({ where: { userId: user.id }, data: { topics: page.topics.slice(0, 15).map((t) => t.slice(0, 50)) } });
          summary.profileFieldsFilled++;
        }
      }
    }
    const site = page.source === "sessionize" ? "Sessionize" : "run.events";
    const note =
      page.talks.length === 0
        ? `No public sessions were found on your ${site} profile.${page.source === "sessionize" ? " Sessionize only shows sessions you've made visible on your public profile — make them visible there, then import again." : ""}`
        : `Found ${page.talks.length} public session${page.talks.length === 1 ? "" : "s"} on ${site}. Format, level and duration aren't on public profiles, so check those on each session.`;
    return done(summary, note);
  } catch (err) {
    return { ok: false, error: message(err, "Import from the profile page failed.") };
  }
}

// ─── Pretalx ─────────────────────────────────────────────────────────────────

export async function pretalxLookup(_prev: LookupState, form: FormData): Promise<LookupState> {
  await requireUser();
  try {
    const target = parsePretalxTarget(String(form.get("instance") ?? ""), String(form.get("event") ?? ""));
    const token = String(form.get("token") ?? "");
    const { submissions } = await fetchPretalx(target, token);
    const speakers = listPretalxSpeakers(submissions);
    if (!speakers.length) return { step: "error", error: "No submissions with speakers were visible. Public access only shows the published schedule — add an API token to see your own submissions." };
    return { step: "pick", speakers, context: { instance: target.instance, event: target.event, token } };
  } catch (err) {
    return { step: "error", error: message(err, "Could not load the Pretalx event.") };
  }
}

export async function pretalxImport(_prev: ImportResult, form: FormData): Promise<ImportResult> {
  const user = await requireUser();
  try {
    const target = parsePretalxTarget(String(form.get("instance") ?? ""), String(form.get("event") ?? ""));
    const speakerId = String(form.get("speakerId") ?? "");
    if (!speakerId) return { ok: false, error: "Pick yourself from the speaker list." };
    const { event, submissions } = await fetchPretalx(target, String(form.get("token") ?? ""));
    const { summary } = await persistTalks(user.id, "pretalx", mapPretalxTalks(target, event, submissions, speakerId));
    return done(summary);
  } catch (err) {
    return { ok: false, error: message(err, "Import from Pretalx failed.") };
  }
}

// ─── Files ───────────────────────────────────────────────────────────────────

async function readUpload(form: FormData): Promise<string> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new SessionizeError("Choose a file to import.");
  if (file.size > MAX_FILE_BYTES) throw new SessionizeError("That file is larger than 5 MB.");
  return file.text();
}

export async function csvImport(_prev: ImportResult, form: FormData): Promise<ImportResult> {
  const user = await requireUser();
  try {
    const text = await readUpload(form);
    let talks: ImportedTalk[];
    try {
      talks = parseTalksCsv(text);
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
    if (!talks.length) return { ok: false, error: "No rows found in that CSV." };
    const { summary } = await persistTalks(user.id, "csv", talks);
    return done(summary);
  } catch (err) {
    return { ok: false, error: message(err, "CSV import failed.") };
  }
}

export async function jsonBackupImport(_prev: ImportResult, form: FormData): Promise<ImportResult> {
  const user = await requireUser();
  try {
    const text = await readUpload(form);
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, error: "That file is not valid JSON." };
    }
    const parsed = backupSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "That isn't a SpeakerDesk backup (format “speakerdesk”, version 1)." };
    const backup = parsed.data;

    const summary = emptySummary();
    const talks: ImportedTalk[] = backup.talks.map((t) => ({
      ...t,
      ref: `backup:${t.id}`,
      customFields: t.customFields ?? undefined,
    }));
    const { talkIdByRef } = await persistTalks(user.id, "json", talks, summary);
    for (const s of backup.submissions) {
      const talkId = s.talkId ? (talkIdByRef.get(`backup:${s.talkId}`) ?? null) : null;
      await persistSubmission(user.id, talkId, { ...s, externalId: s.externalId || `backup:${s.id}` }, summary);
    }
    if (backup.profile) {
      const profile = profileSchema.partial().safeParse(backup.profile);
      if (profile.success) summary.profileFieldsFilled = await fillEmptyProfile(user.id, profile.data);
    }
    return done(summary);
  } catch (err) {
    return { ok: false, error: message(err, "Backup import failed.") };
  }
}
