// Client-safe: used by the settings form (preview) and the server (sending).

import { renderTemplate, unknownTokens } from "@/lib/email-template";

export const DEFAULT_CONFIRMATION_SUBJECT = "{EVENT_NAME}: your session {SESSION_NAME} was submitted";

export const DEFAULT_CONFIRMATION_BODY = `Your session {SESSION_NAME} has been successfully submitted! Thanks!

It may be a good idea to add this sender to your whitelist / safe senders list, so you don't miss out on any updates from this event.

You can track and manage your sessions in the speaker dashboard. There you can also create your public speaker profile and let the world know you're out there, ready to speak!

{SPEAKER_DASHBOARD_BUTTON}

Thanks,
{EVENT_NAME}`;

/** Placeholders organizers can use. Filled automatically when the email is sent. */
export const CONFIRMATION_PLACEHOLDERS = {
  SPEAKER_NAME: "The speaker's name",
  SESSION_NAME: "Title of the submitted session",
  EVENT_NAME: "Your event's name",
  EVENT_URL: "Link to your public event page",
  SPEAKER_DASHBOARD_BUTTON: "A button (a link in plain-text mail) to the speaker dashboard",
} as const;

export type ConfirmationValues = Record<Exclude<keyof typeof CONFIRMATION_PLACEHOLDERS, "SPEAKER_DASHBOARD_BUTTON">, string> & { DASHBOARD_URL: string };

/** Placeholders in a template that we don't know: shown as a validation error on save. */
export function unknownPlaceholders(template: string): string[] {
  return unknownTokens(template, CONFIRMATION_PLACEHOLDERS);
}

/** Fills a template. Values are inserted as text, never as markup, so a session title can't inject HTML. */
export function renderConfirmation(template: { subject: string; body: string }, v: ConfirmationValues) {
  return renderTemplate(
    { subject: template.subject.trim() || DEFAULT_CONFIRMATION_SUBJECT, body: template.body.trim() || DEFAULT_CONFIRMATION_BODY },
    v,
    { token: "SPEAKER_DASHBOARD_BUTTON", label: "Open speaker dashboard", url: v.DASHBOARD_URL },
  );
}
