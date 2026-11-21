// Client-safe: organizer-editable email templates with {PLACEHOLDER} tokens, used by the
// submission confirmation and decision emails (settings previews and sending).

const TOKEN = /\{([A-Z_]+)\}/g;

/** Placeholders in a template that aren't in `known`: shown as a validation error on save. */
export function unknownTokens(template: string, known: Record<string, string>): string[] {
  return [...new Set([...template.matchAll(TOKEN)].map((m) => m[1]).filter((t) => !(t in known)))];
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** One token that renders as a button in HTML mail and as a labelled link in plain text. */
export type TemplateButton = { token: string; label: string; url: string };

/** Wraps simple HTML paragraphs in the shared SpeakerDesk mail layout. */
export const mailLayout = (htmlBody: string) =>
  `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f4"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">${htmlBody}</div></body></html>`;

/**
 * Fills a template. Values are inserted as text, never as markup, so a session title can't
 * inject HTML. Unknown tokens are left as they are.
 */
export function renderTemplate(template: { subject: string; body: string }, values: Record<string, string>, button?: TemplateButton) {
  const textValue = (key: string) => (button && key === button.token ? `${button.label}: ${button.url}` : (values[key] ?? `{${key}}`));
  const subject = template.subject
    .replace(TOKEN, (_, k: string) => (button && k === button.token ? "" : textValue(k)))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  const text = template.body.replace(TOKEN, (_, k: string) => textValue(k));

  const buttonHtml = button
    ? `<a href="${escapeHtml(button.url)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${escapeHtml(button.label)}</a>`
    : "";
  const htmlBody = template.body
    .split(/\n{2,}/)
    .map((para) => {
      const inner = para
        .split(TOKEN)
        // split() with a capture group alternates text and token names
        .map((part, i) => (i % 2 === 0 ? escapeHtml(part) : button && part === button.token ? buttonHtml : escapeHtml(textValue(part))))
        .join("")
        .replace(/\n/g, "<br>");
      return `<p style="margin:0 0 16px">${inner}</p>`;
    })
    .join("");
  return { subject, text, html: mailLayout(htmlBody) };
}
