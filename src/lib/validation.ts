import { z } from "zod";
import { DEFAULT_CONFIRMATION_BODY, DEFAULT_CONFIRMATION_SUBJECT, unknownPlaceholders } from "@/lib/confirmation-email";
import { COVER_FITS, COVER_POSITIONS, CURRENCIES, EVENT_FORMATS, PLATFORMS, SUBMISSION_STATUSES, TALK_FORMATS, TALK_LEVELS } from "@/lib/domain";
import { isPresentationRequirement, isSponsorRequirement } from "@/lib/requirements";

/** Only http(s) URLs are allowed so stored links can never become `javascript:` hrefs. */
export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters`).default("");
const url = z
  .string()
  .trim()
  .max(2000)
  .default("")
  .refine((v) => v === "" || isHttpUrl(v), "Enter a full http(s):// URL");
const optionalDate = z
  .string()
  .trim()
  .default("")
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
      return z.NEVER;
    }
    return d;
  });

export const profileSchema = z.object({
  fullName: text(120),
  tagline: text(160),
  company: text(120),
  jobTitle: text(120),
  pronouns: text(40),
  bioShort: text(1000),
  bioMedium: text(3000),
  bioLong: text(20000),
  country: text(80),
  city: text(80),
  timezone: text(80),
  headshotSquareUrl: url,
  headshotWideUrl: url,
  websiteUrl: url,
  linkedinUrl: url,
  githubUrl: url,
  xUrl: url,
  blueskyUrl: url,
  mastodonUrl: url,
  youtubeUrl: url,
  sessionizeUrl: url,
  tshirtSize: text(10),
  travelNotes: text(2000),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const talkSchema = z.object({
  title: z.string().trim().min(1, "A title is required").max(300),
  subtitle: text(300),
  abstractShort: text(5000),
  abstractLong: text(20000),
  outline: text(50000),
  takeaways: z.array(z.string().trim().max(500)).max(10).transform((a) => a.filter(Boolean)),
  format: z.enum(TALK_FORMATS),
  durationMinutes: z.coerce.number().int().min(1).max(1440),
  level: z.enum(TALK_LEVELS),
  primaryTrack: text(120),
  tags: z
    .array(z.string().trim().toLowerCase().max(50))
    .max(30)
    .transform((a) => [...new Set(a.filter(Boolean))]),
  language: text(20),
  equipmentNeeds: text(2000),
  organizerNotes: text(5000),
  slidesUrl: url,
  videoUrl: url,
  coSpeakers: text(500),
});
export type TalkInput = z.infer<typeof talkSchema>;

/** Optional whole number; empty means "not known yet". Defined before use (module order). */
const countField = (max = 10_000_000) =>
  z
    .string()
    .trim()
    .default("")
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > max) {
        ctx.addIssue({ code: "custom", message: `Use a whole number from 0 to ${max.toLocaleString("en")}` });
        return z.NEVER;
      }
      return n;
    });

export const submissionSchema = z
  .object({
    talkId: z.string().trim().default(""),
    eventName: z.string().trim().min(1, "Event name is required").max(200),
    eventUrl: url,
    cfpUrl: url,
    platform: z.enum(PLATFORMS),
    location: text(200),
    status: z.enum(SUBMISSION_STATUSES),
    cfpDeadline: optionalDate,
    eventStart: optionalDate,
    eventEnd: optionalDate,
    submittedAt: optionalDate,
    recordingUrl: url,
    notes: text(10000),
    mvpTechnologyArea: text(120),
    targetAudience: text(200),
    microsoftEvent: z.string().optional().transform((v) => v === "on"),
    inPersonAttendees: countField(),
    liveStreamViews: countField(),
    onDemandViews: countField(),
  })
  .refine((s) => !s.eventStart || !s.eventEnd || s.eventEnd >= s.eventStart, {
    message: "End date must be after start date",
    path: ["eventEnd"],
  });
export type SubmissionInput = z.infer<typeof submissionSchema>;

const optionalInt = (min: number, max: number) =>
  z
    .string()
    .trim()
    .default("")
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `Use a whole number between ${min} and ${max}` });
        return z.NEVER;
      }
      return n;
    });

const optionalCoord = (min: number, max: number) =>
  z
    .string()
    .trim()
    .default("")
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: "Invalid coordinates" });
        return z.NEVER;
      }
      return n;
    });

/** Cover is either a bundled photo path or an http(s) URL. */
const coverImage = z
  .string()
  .trim()
  .default("")
  .refine((v) => v === "" || /^\/images\/events\/[a-z-]+\.jpg$/.test(v) || isHttpUrl(v), "Pick a photo or enter an image URL");

export const eventSchema = z
  .object({
    name: z.string().trim().min(2, "Give the event a name").max(150),
    tagline: text(200),
    description: text(10000),
    format: z.enum(EVENT_FORMATS).default("IN_PERSON"),
    coverFit: z.enum(COVER_FITS).default("cover"),
    coverPosition: z.enum(COVER_POSITIONS).default("center"),
    onlinePlatform: text(100),
    location: text(150),
    venue: text(150),
    address: text(300),
    latitude: optionalCoord(-90, 90),
    longitude: optionalCoord(-180, 180),
    website: url,
    coverImage,
    startDate: optionalDate,
    endDate: optionalDate,
    cfpOpensAt: optionalDate,
    cfpClosesAt: optionalDate,
    cfpGuidelines: text(10000),
    tracks: z.array(z.string().trim().max(80)).max(30).transform((a) => [...new Set(a.filter(Boolean))]),
    formats: z.array(z.enum(TALK_FORMATS)).max(TALK_FORMATS.length),
    titleLimit: optionalInt(10, 500),
    abstractLimit: optionalInt(100, 20000),
    maxProposalsPerSpeaker: z.coerce.number().int().min(1, "At least 1").max(20, "At most 20"),
    blindReview: z.string().optional().transform((v) => v === "on"),
    confirmationEmailEnabled: z.string().optional().transform((v) => v === "on"),
    confirmationEmailSubject: text(200),
    confirmationEmailBody: text(5000),
  })
  // Online events have no venue; keep stale venue data from being shown or mapped.
  .transform((e) => (e.format === "ONLINE" ? { ...e, location: "Online", venue: "", address: "", latitude: null, longitude: null } : { ...e, onlinePlatform: e.format === "IN_PERSON" ? "" : e.onlinePlatform }))
  // Store "" when the organizer kept the built-in text, so improvements to the default reach them.
  .transform((e) => ({
    ...e,
    confirmationEmailSubject: e.confirmationEmailSubject === DEFAULT_CONFIRMATION_SUBJECT ? "" : e.confirmationEmailSubject,
    confirmationEmailBody: e.confirmationEmailBody.replace(/\r\n/g, "\n") === DEFAULT_CONFIRMATION_BODY ? "" : e.confirmationEmailBody,
  }))
  .superRefine((e, ctx) => {
    for (const field of ["confirmationEmailSubject", "confirmationEmailBody"] as const) {
      const unknown = unknownPlaceholders(e[field]);
      if (unknown.length) ctx.addIssue({ code: "custom", path: [field], message: `Unknown placeholder: ${unknown.map((p) => `{${p}}`).join(", ")}` });
    }
  })
  .refine((e) => !e.startDate || !e.endDate || e.endDate >= e.startDate, { message: "End date must be after start date", path: ["endDate"] })
  .refine((e) => !e.cfpOpensAt || !e.cfpClosesAt || e.cfpClosesAt >= e.cfpOpensAt, { message: "CfP must close after it opens", path: ["cfpClosesAt"] });
export type EventInput = z.infer<typeof eventSchema>;

export const proposalSchema = z.object({
  talkId: z.string().trim().default(""),
  title: z.string().trim().min(1, "A title is required").max(300),
  abstract: z.string().trim().min(1, "An abstract is required").max(20000),
  takeaways: z.array(z.string().trim().max(500)).max(10).transform((a) => a.filter(Boolean)),
  format: z.enum(TALK_FORMATS),
  durationMinutes: z.coerce.number().int().min(1).max(1440),
  level: z.enum(TALK_LEVELS),
  track: text(80),
  notes: text(5000),
  requirements: z
    .array(z.string())
    .max(40)
    .transform((a) => [...new Set(a)])
    .refine((a) => a.every(isPresentationRequirement), "Unknown requirement"),
  requirementsNote: text(2000),
});
export type ProposalInput = z.infer<typeof proposalSchema>;

// ─── Sponsorship ─────────────────────────────────────────────────────────────

const lines = (max: number) => z.array(z.string().trim().max(200)).max(max).transform((a) => a.filter(Boolean));
const money = (label: string) => z.coerce.number({ message: `${label} must be a number` }).int("Use whole amounts").min(0, "Can't be negative").max(100_000_000);

export const budgetSchema = z.object({
  currency: z.enum(CURRENCIES),
  budgetTarget: optionalInt(0, 100_000_000),
  otherIncome: money("Other income"),
  prospectusIntro: text(5000),
});

export const packageSchema = z.object({
  kind: z.enum(["TIER", "ADDON"]),
  name: z.string().trim().min(1, "Give the package a name").max(80),
  tagline: text(200),
  price: money("Price"),
  quantity: optionalInt(1, 1000),
  benefits: lines(20),
  deliverables: lines(15),
  featured: z.string().optional().transform((v) => v === "on"),
  published: z.string().optional().transform((v) => v === "on"),
});
export type PackageInput = z.infer<typeof packageSchema>;

export const sponsorOrgSchema = z.object({
  name: z.string().trim().min(2, "Company name is required").max(120),
  website: url,
  logoUrl: url,
  description: text(2000),
  contactName: text(120),
  contactEmail: z.string().trim().max(200).default("").refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email"),
});

export const sponsorshipRequestSchema = z.object({
  packageIds: z.array(z.string()).max(30).transform((a) => [...new Set(a.filter(Boolean))]),
  requirements: z
    .array(z.string())
    .max(40)
    .transform((a) => [...new Set(a)])
    .refine((a) => a.every(isSponsorRequirement), "Unknown requirement"),
  requirementsNote: text(2000),
  message: text(3000),
});

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title").max(200),
  description: text(5000),
  category: z.string().trim().min(1).max(40),
  dueDate: optionalDate,
  priority: z.enum(["LOW", "NORMAL", "HIGH"]),
  status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]).default("TODO"),
  assigneeId: z.string().trim().default(""),
});

export const publicProfileSchema = z.object({
  publicProfile: z.string().optional().transform((v) => v === "on"),
  openToInvites: z.string().optional().transform((v) => v === "on"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .default("")
    .refine((v) => v === "" || /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/.test(v), "3–50 characters: lowercase letters, numbers and dashes"),
  availabilityNote: text(200),
  topics: z.array(z.string().trim().toLowerCase().max(40)).max(12).transform((a) => [...new Set(a.filter(Boolean))]),
});

export const speakerInviteSchema = z.object({
  eventId: z.string().min(1, "Pick an event"),
  talkId: z.string().trim().default(""),
  message: z.string().trim().min(10, "Write a short personal note (at least 10 characters)").max(3000),
});

export const reviewSchema = z.object({
  score: z.coerce.number().int().min(1, "Pick a score").max(5),
  comment: text(5000),
});

export type FieldErrors = Record<string, string[] | undefined>;
export type ActionState = { ok?: boolean; message?: string; errors?: FieldErrors } | undefined;

export function fieldErrors(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}

/** FormData → plain object; keys listed in `arrays` are read with getAll(). */
export function formToObject(form: FormData, arrays: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(form.keys())) {
    if (key.startsWith("$")) continue; // React internal action fields
    out[key] = arrays.includes(key) ? form.getAll(key).map(String) : String(form.get(key) ?? "");
  }
  for (const key of arrays) out[key] ??= [];
  return out;
}
