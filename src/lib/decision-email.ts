// Client-safe: the emails speakers get when an event publishes decisions. Organizers can edit
// them per event (Settings); empty templates fall back to these built-in ones.

import { renderTemplate, unknownTokens } from "@/lib/email-template";

export const DECISION_EMAIL_KINDS = ["accepted", "waitlisted", "rejected"] as const;
export type DecisionEmailKind = (typeof DECISION_EMAIL_KINDS)[number];

export const DECISION_EMAIL_LABELS: Record<DecisionEmailKind, string> = {
  accepted: "Accepted",
  waitlisted: "Waitlisted",
  rejected: "Not selected",
};

export type EmailTemplate = { subject: string; body: string };
export type DecisionEmails = Partial<Record<DecisionEmailKind, EmailTemplate>>;

export const DEFAULT_DECISION_EMAILS: Record<DecisionEmailKind, EmailTemplate> = {
  accepted: {
    subject: "{EVENT_NAME}: your session {SESSION_NAME} was accepted",
    body: `Hi {SPEAKER_NAME},

Great news: your session {SESSION_NAME} has been accepted for {EVENT_NAME} ({EVENT_DATES}).

Please confirm that you'll be there, or let us know if you can't make it, so we can plan the programme:

{SESSION_BUTTON}

We'll send you your time slot as soon as the schedule is ready.

Thanks,
{EVENT_NAME}`,
  },
  waitlisted: {
    subject: "{EVENT_NAME}: your session {SESSION_NAME} is on the waitlist",
    body: `Hi {SPEAKER_NAME},

Thank you for submitting {SESSION_NAME} to {EVENT_NAME}. We received more great proposals than we have slots, and your session is on our waitlist. If a slot opens up, we'll let you know straight away.

{SESSION_BUTTON}

Thanks,
{EVENT_NAME}`,
  },
  rejected: {
    subject: "{EVENT_NAME}: about your session {SESSION_NAME}",
    body: `Hi {SPEAKER_NAME},

Thank you for submitting {SESSION_NAME} to {EVENT_NAME}. We received many strong proposals, and unfortunately we couldn't include yours in the programme this time.

We really appreciate the work you put into it, and we hope to see a proposal from you again.

{SESSION_BUTTON}

Thanks,
{EVENT_NAME}`,
  },
};

export const DECISION_PLACEHOLDERS = {
  SPEAKER_NAME: "The speaker's name",
  SESSION_NAME: "Title of the session",
  EVENT_NAME: "Your event's name",
  EVENT_DATES: "The event dates",
  EVENT_URL: "Link to your public event page",
  SESSION_BUTTON: "A button to the speaker's session page (where accepted speakers confirm)",
} as const;

export type DecisionValues = Record<Exclude<keyof typeof DECISION_PLACEHOLDERS, "SESSION_BUTTON">, string> & { SESSION_URL: string };

export const unknownDecisionPlaceholders = (template: string) => unknownTokens(template, DECISION_PLACEHOLDERS);

/** Reads the stored JSON defensively: anything malformed counts as "use the built-in text". */
export function parseDecisionEmails(raw: unknown): DecisionEmails {
  const out: DecisionEmails = {};
  if (!raw || typeof raw !== "object") return out;
  for (const kind of DECISION_EMAIL_KINDS) {
    const t = (raw as Record<string, unknown>)[kind];
    if (t && typeof t === "object") {
      const { subject, body } = t as Record<string, unknown>;
      out[kind] = { subject: typeof subject === "string" ? subject : "", body: typeof body === "string" ? body : "" };
    }
  }
  return out;
}

export function renderDecisionEmail(kind: DecisionEmailKind, templates: DecisionEmails, v: DecisionValues) {
  const custom = templates[kind];
  const fallback = DEFAULT_DECISION_EMAILS[kind];
  return renderTemplate(
    { subject: custom?.subject.trim() || fallback.subject, body: custom?.body.trim() || fallback.body },
    v,
    { token: "SESSION_BUTTON", label: kind === "accepted" ? "Confirm your session" : "View your submission", url: v.SESSION_URL },
  );
}
