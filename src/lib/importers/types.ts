import type { ProfileInput } from "@/lib/validation";
import type { Platform, SubmissionStatus, TalkFormat, TalkLevel } from "@/lib/domain";

/** Normalized talk coming out of any importer. */
export type ImportedTalk = {
  ref: string; // stable id at the source, used for de-duplication
  title: string;
  subtitle?: string;
  abstractShort?: string;
  abstractLong?: string;
  outline?: string;
  takeaways?: string[];
  format?: TalkFormat;
  level?: TalkLevel;
  durationMinutes?: number;
  primaryTrack?: string;
  tags?: string[];
  language?: string;
  slidesUrl?: string;
  videoUrl?: string;
  customFields?: Record<string, unknown>;
  submission?: ImportedSubmission;
};

export type ImportedSubmission = {
  externalId: string;
  eventName: string;
  eventUrl?: string;
  platform: Platform;
  status: SubmissionStatus;
  eventStart?: Date | null;
  eventEnd?: Date | null;
  location?: string;
  recordingUrl?: string;
  cfpUrl?: string;
  cfpDeadline?: Date | null;
  submittedAt?: Date | null;
  notes?: string;
  platformData?: Record<string, unknown>;
};

export type ImportedProfile = Partial<Record<keyof ProfileInput, string>>;

export type ImportSummary = {
  talksCreated: number;
  talksMatched: number; // existing talk re-used (same source ref or same title)
  submissionsCreated: number;
  submissionsSkipped: number; // already tracked
  profileFieldsFilled: number;
};

export type ImportState =
  | { step: "idle"; error?: string }
  | { step: "done"; summary: ImportSummary; error?: undefined }
  | { step: "error"; error: string };
