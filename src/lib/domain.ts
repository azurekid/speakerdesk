// Client-safe domain constants. Values mirror the Prisma enums in prisma/schema.prisma.

export const COVER_FITS = ["cover", "contain"] as const;
export type CoverFit = (typeof COVER_FITS)[number];
export const COVER_POSITIONS = ["top", "center", "bottom"] as const;
export type CoverPosition = (typeof COVER_POSITIONS)[number];
/** Recommended cover size. Cards crop to 16:9, the event banner to a wide strip. */
export const COVER_RECOMMENDED = { width: 1920, height: 1080, minWidth: 1200, minHeight: 675 } as const;

export const EVENT_FORMATS = ["IN_PERSON", "ONLINE", "HYBRID"] as const;
export type EventFormat = (typeof EVENT_FORMATS)[number];
export const EVENT_FORMAT_LABELS: Record<EventFormat, string> = { IN_PERSON: "In person", ONLINE: "Online", HYBRID: "Hybrid" };

/** One line for where an event happens: "Amsterdam, NL", "Online · Zoom", "Amsterdam, NL + online". */
export function eventWhere(e: { format: EventFormat; location: string; onlinePlatform: string }): string {
  if (e.format === "ONLINE") return ["Online", e.onlinePlatform].filter(Boolean).join(" · ");
  if (e.format === "HYBRID") return e.location ? `${e.location} + online` : "Hybrid";
  return e.location;
}

export const TALK_FORMATS = ["SESSION", "WORKSHOP", "LIGHTNING_TALK", "PANEL", "KEYNOTE", "OTHER"] as const;
export type TalkFormat = (typeof TALK_FORMATS)[number];
export const FORMAT_LABELS: Record<TalkFormat, string> = {
  SESSION: "Session",
  WORKSHOP: "Workshop",
  LIGHTNING_TALK: "Lightning talk",
  PANEL: "Panel",
  KEYNOTE: "Keynote",
  OTHER: "Other",
};

export const TALK_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;
export type TalkLevel = (typeof TALK_LEVELS)[number];
export const LEVEL_LABELS: Record<TalkLevel, string> = {
  BEGINNER: "100 · Beginner",
  INTERMEDIATE: "200 · Intermediate",
  ADVANCED: "300 · Advanced",
  EXPERT: "400 · Expert",
};

export const DURATIONS = [5, 10, 15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 120, 180, 240, 480] as const;

export const SUBMISSION_STATUSES = ["DRAFT", "SUBMITTED", "ACCEPTED", "WAITLISTED", "REJECTED", "WITHDRAWN"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  ACCEPTED: "Accepted",
  WAITLISTED: "Waitlisted",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};
export const STATUS_STYLES: Record<SubmissionStatus, string> = {
  DRAFT: "bg-stone-100 text-stone-700 ring-stone-200",
  SUBMITTED: "bg-sky-50 text-sky-800 ring-sky-200",
  ACCEPTED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  WAITLISTED: "bg-amber-50 text-amber-800 ring-amber-200",
  REJECTED: "bg-rose-50 text-rose-800 ring-rose-200",
  WITHDRAWN: "bg-stone-50 text-stone-500 ring-stone-200",
};

export const PLATFORMS = ["SESSIONIZE", "RUN_EVENTS", "PRETALX", "PAPERCALL", "SPEAKERDESK", "OTHER"] as const;
export type Platform = (typeof PLATFORMS)[number];
export const PLATFORM_LABELS: Record<Platform, string> = {
  SESSIONIZE: "Sessionize",
  RUN_EVENTS: "run.events",
  PRETALX: "Pretalx",
  PAPERCALL: "PaperCall",
  SPEAKERDESK: "SpeakerDesk",
  OTHER: "Other",
};

export const TSHIRT_SIZES = ["", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"] as const;

/** Soft targets for the three bio versions. */
export const BIO_LIMITS = { short: 300, medium: 1000 } as const;
/** Soft targets for the two abstract versions. */
export const ABSTRACT_LIMITS = { short: 500, long: 2000 } as const;

/** Best-effort mapping of free text (from imports) to our enums. */
export function guessFormat(text: string | null | undefined): TalkFormat | undefined {
  const t = (text ?? "").toLowerCase();
  if (!t) return undefined;
  if (t.includes("lightning")) return "LIGHTNING_TALK";
  if (t.includes("workshop") || t.includes("hands-on") || t.includes("lab")) return "WORKSHOP";
  if (t.includes("panel")) return "PANEL";
  if (t.includes("keynote")) return "KEYNOTE";
  if (t.includes("talk") || t.includes("session") || t.includes("presentation")) return "SESSION";
  return undefined;
}

export function guessLevel(text: string | null | undefined): TalkLevel | undefined {
  const t = (text ?? "").toLowerCase();
  if (!t) return undefined;
  if (t.includes("400") || t.includes("expert")) return "EXPERT";
  if (t.includes("300") || t.includes("advanced")) return "ADVANCED";
  if (t.includes("200") || t.includes("intermediate")) return "INTERMEDIATE";
  if (t.includes("100") || t.includes("beginner") || t.includes("introductory")) return "BEGINNER";
  return undefined;
}

export function guessDuration(text: string | null | undefined): number | undefined {
  const m = (text ?? "").match(/(\d{1,3})\s*(?:min|m\b|minutes)/i);
  return m ? Number(m[1]) : undefined;
}

// ─── Organizer side ──────────────────────────────────────────────────────────

export const DECISIONS = ["UNDECIDED", "ACCEPTED", "WAITLISTED", "REJECTED"] as const;
export type Decision = (typeof DECISIONS)[number];
export const DECISION_LABELS: Record<Decision, string> = {
  UNDECIDED: "Undecided",
  ACCEPTED: "Accept",
  WAITLISTED: "Waitlist",
  REJECTED: "Reject",
};
export const DECISION_STYLES: Record<Decision, string> = {
  UNDECIDED: "bg-stone-50 text-stone-600 ring-stone-200",
  ACCEPTED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  WAITLISTED: "bg-amber-50 text-amber-800 ring-amber-200",
  REJECTED: "bg-rose-50 text-rose-800 ring-rose-200",
};
/** How a published decision shows up in the speaker's tracker. */
export const DECISION_TO_STATUS: Record<Exclude<Decision, "UNDECIDED">, SubmissionStatus> = {
  ACCEPTED: "ACCEPTED",
  WAITLISTED: "WAITLISTED",
  REJECTED: "REJECTED",
};

/** Bundled event photography (see public/images/events/CREDITS.md). */
export const COVER_IMAGES = [
  { src: "/images/events/main-stage.jpg", label: "Main stage" },
  { src: "/images/events/speaker-screen.jpg", label: "Keynote screen" },
  { src: "/images/events/audience.jpg", label: "Audience" },
  { src: "/images/events/audience-question.jpg", label: "Q&A" },
  { src: "/images/events/panel.jpg", label: "Panel" },
  { src: "/images/events/meetup.jpg", label: "Meetup" },
  { src: "/images/events/workshop.jpg", label: "Workshop" },
  { src: "/images/events/hall.jpg", label: "Hall" },
  { src: "/images/events/networking.jpg", label: "Networking" },
  { src: "/images/events/microphone.jpg", label: "Microphone" },
] as const;

export type CfpState = "draft" | "upcoming" | "open" | "closed";
export const CFP_STATE_LABELS: Record<CfpState, string> = {
  draft: "Not published",
  upcoming: "Opens soon",
  open: "CfP open",
  closed: "CfP closed",
};

export function cfpState(e: { cfpPublished: boolean; cfpOpensAt: Date | null; cfpClosesAt: Date | null }, now = new Date()): CfpState {
  if (!e.cfpPublished) return "draft";
  if (e.cfpOpensAt && now < e.cfpOpensAt) return "upcoming";
  // Closing dates are date-only (UTC midnight); the CfP stays open through that whole day.
  if (e.cfpClosesAt && now.getTime() >= e.cfpClosesAt.getTime() + 86_400_000) return "closed";
  return "open";
}

// ─── Sponsorship ─────────────────────────────────────────────────────────────

export const SPONSORSHIP_STATUSES = ["APPLIED", "APPROVED", "INVOICED", "PAID", "DECLINED", "CANCELLED"] as const;
export type SponsorshipStatus = (typeof SPONSORSHIP_STATUSES)[number];
export const SPONSORSHIP_LABELS: Record<SponsorshipStatus, string> = {
  APPLIED: "Requested",
  APPROVED: "Confirmed",
  INVOICED: "Invoiced",
  PAID: "Paid",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
};
export const SPONSORSHIP_STYLES: Record<SponsorshipStatus, string> = {
  APPLIED: "bg-sky-50 text-sky-800 ring-sky-200",
  APPROVED: "bg-violet-50 text-violet-800 ring-violet-200",
  INVOICED: "bg-amber-50 text-amber-800 ring-amber-200",
  PAID: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  DECLINED: "bg-neutral-100 text-neutral-600 ring-neutral-200",
  CANCELLED: "bg-neutral-100 text-neutral-500 ring-neutral-200",
};
/** Statuses that count towards the budget as committed money. */
export const COMMITTED_STATUSES: SponsorshipStatus[] = ["APPROVED", "INVOICED", "PAID"];
/** Statuses that hold a package slot (so sold-out counts stay honest). */
export const SLOT_HOLDING_STATUSES: SponsorshipStatus[] = ["APPLIED", "APPROVED", "INVOICED", "PAID"];

export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CAD", "AUD"] as const;

export function formatMoney(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}
