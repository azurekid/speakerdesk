// Client-safe: used by the settings form (preview) and the server (sending).

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

const TOKEN = /\{([A-Z_]+)\}/g;

/** Placeholders in a template that we don't know — shown as a validation error on save. */
export function unknownPlaceholders(template: string): string[] {
  return [...new Set([...template.matchAll(TOKEN)].map((m) => m[1]).filter((t) => !(t in CONFIRMATION_PLACEHOLDERS)))];
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Fills a template. Values are inserted as text — never as markup — so a session title can't inject HTML. */
export function renderConfirmation(template: { subject: string; body: string }, v: ConfirmationValues) {
  const subjectTpl = template.subject.trim() || DEFAULT_CONFIRMATION_SUBJECT;
  const bodyTpl = template.body.trim() || DEFAULT_CONFIRMATION_BODY;
  const textValue = (key: string) => (key === "SPEAKER_DASHBOARD_BUTTON" ? `Open your speaker dashboard: ${v.DASHBOARD_URL}` : (v[key as keyof ConfirmationValues] ?? `{${key}}`));

  const subject = subjectTpl.replace(TOKEN, (_, k: string) => (k === "SPEAKER_DASHBOARD_BUTTON" ? "" : textValue(k))).replace(/\s+/g, " ").trim().slice(0, 200);
  const text = bodyTpl.replace(TOKEN, (_, k: string) => textValue(k));

  const button = `<a href="${escapeHtml(v.DASHBOARD_URL)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Open speaker dashboard</a>`;
  const htmlBody = bodyTpl
    .split(/\n{2,}/)
    .map((para) => {
      const inner = para
        .split(TOKEN)
        // split() with a capture group alternates text and token names
        .map((part, i) => (i % 2 === 0 ? escapeHtml(part) : part === "SPEAKER_DASHBOARD_BUTTON" ? button : escapeHtml(textValue(part))))
        .join("")
        .replace(/\n/g, "<br>");
      return `<p style="margin:0 0 16px">${inner}</p>`;
    })
    .join("");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f4"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">${htmlBody}</div></body></html>`;
  return { subject, text, html };
}
