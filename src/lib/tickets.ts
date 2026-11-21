import "server-only";
import { randomBytes } from "node:crypto";
import { formatDateRange } from "@/lib/dates";
import { appUrl } from "@/lib/app-url";
import { prisma } from "@/lib/db";
import { eventWhere } from "@/lib/domain";
import { escapeHtml } from "@/lib/email-template";
import { appleWalletConfigured } from "@/lib/wallet/apple";
import { googleWalletConfigured } from "@/lib/wallet/google";
import { sendMailInBackground } from "@/lib/mailer";

/** 128 bits, URL-safe: the ticket link and QR code can't be guessed. */
export const newTicketCode = () => randomBytes(16).toString("base64url");

export const ticketUrl = (code: string) => `${appUrl()}/tickets/${code}`;
export const qrUrl = (code: string) => `${appUrl()}/tickets/${code}/qr.png`;

type RegEvent = { id: string; registrationOpen: boolean; registrationCapacity: number | null; registrationClosesAt: Date | null; startDate: Date | null; endDate: Date | null };

export type RegistrationState = "not-open" | "open" | "closed" | "full" | "ended";

/** Can people register right now? Closing dates are date-only and open through that day (UTC). */
export function registrationState(event: RegEvent, active: number, now = new Date()): RegistrationState {
  if (!event.registrationOpen) return "not-open";
  const last = event.endDate ?? event.startDate;
  if (last && now.getTime() >= last.getTime() + 86_400_000) return "ended";
  if (event.registrationClosesAt && now.getTime() >= event.registrationClosesAt.getTime() + 86_400_000) return "closed";
  if (event.registrationCapacity !== null && active >= event.registrationCapacity) return "full";
  return "open";
}

/** Ticket types with how many are taken and left, plus the event totals. */
export async function ticketAvailability(eventId: string) {
  const [types, counts, total] = await Promise.all([
    prisma.ticketType.findMany({ where: { eventId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    prisma.registration.groupBy({ by: ["ticketTypeId"], where: { eventId, status: "ACTIVE" }, _count: true }),
    prisma.registration.count({ where: { eventId, status: "ACTIVE" } }),
  ]);
  const taken = new Map(counts.map((c) => [c.ticketTypeId, c._count]));
  return {
    total,
    types: types.map((t) => {
      const used = taken.get(t.id) ?? 0;
      return { ...t, taken: used, left: t.capacity === null ? null : Math.max(0, t.capacity - used) };
    }),
  };
}

type TicketMailEvent = {
  name: string; slug: string; startDate: Date | null; endDate: Date | null; venue: string; address: string; location: string;
  format: "IN_PERSON" | "ONLINE" | "HYBRID"; onlinePlatform: string; coverImage: string;
};
type TicketMailRegistration = { code: string; name: string; email: string; ticketType: { name: string } | null };

/** The banner as an absolute URL mail clients can load: bundled photos go through the image optimizer. */
export function bannerUrl(coverImage: string) {
  if (coverImage.startsWith("/")) return `${appUrl()}/_next/image?url=${encodeURIComponent(coverImage)}&w=1200&q=75`;
  return coverImage.startsWith("https://") ? coverImage : null;
}

/** The ticket email: event banner, QR code, the essentials, wallet buttons and a cancel link. */
export function renderTicketEmail(event: TicketMailEvent, r: TicketMailRegistration) {
  const when = formatDateRange(event.startDate, event.endDate);
  const where = (event.format === "ONLINE" ? `Online${event.onlinePlatform ? ` (${event.onlinePlatform})` : ""}` : [event.venue, event.address || eventWhere(event)].filter(Boolean).join(", ")) || "To be announced";
  const first = r.name.split(" ")[0];
  const ticket = ticketUrl(r.code);
  const cancel = `${ticket}/cancel`;
  const calendar = `${appUrl()}/events/${event.slug}/calendar.ics`;
  const apple = appleWalletConfigured() ? `${ticket}/wallet.pkpass` : null;
  const google = googleWalletConfigured() ? `${ticket}/google-wallet` : null;
  const banner = bannerUrl(event.coverImage);
  const subject = `Your ticket for ${event.name}`;

  const text = `Hi ${first},

You're registered for ${event.name}.

When: ${when}
Where: ${where}
Ticket: ${r.ticketType?.name ?? "General admission"}

Show the QR code on your ticket at the entrance (on your phone or printed):
${ticket}
${apple ? `\nAdd to Apple Wallet: ${apple}` : ""}${google ? `\nSave to Google Wallet: ${google}` : ""}
Add it to your calendar: ${calendar}

Can't come after all? Cancel your ticket, so someone else can have your place:
${cancel}

See you there,
${event.name}`;

  const e = escapeHtml;
  const button = (href: string, label: string, dark = true) =>
    `<a href="${e(href)}" style="display:inline-block;margin:0 8px 8px 0;background:${dark ? "#111" : "#fff"};color:${dark ? "#fff" : "#111"};border:1px solid #111;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;font-size:14px">${e(label)}</a>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:24px 12px;background:#f6f6f4">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
${banner ? `<img src="${e(banner)}" width="560" alt="${e(event.name)}" style="display:block;width:100%;max-width:560px;height:auto;border:0">` : ""}
<div style="padding:28px">
<p style="margin:0 0 16px">Hi ${e(first)},</p>
<p style="margin:0 0 16px">You're registered for <strong>${e(event.name)}</strong>.</p>
<p style="margin:0 0 16px;text-align:center"><img src="${e(qrUrl(r.code))}" width="220" height="220" alt="Your ticket QR code" style="display:inline-block;border:8px solid #fff"></p>
<table style="margin:0 0 16px;border-collapse:collapse;font-size:14px">
<tr><td style="padding:2px 12px 2px 0;color:#666">When</td><td>${e(when)}</td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#666">Where</td><td>${e(where)}</td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#666">Ticket</td><td>${e(r.ticketType?.name ?? "General admission")}</td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#666">Name</td><td>${e(r.name)}</td></tr>
</table>
<p style="margin:0 0 8px">${button(ticket, "Open your ticket")}${apple ? button(apple, "Add to Apple Wallet") : ""}${google ? button(google, "Save to Google Wallet") : ""}</p>
<p style="margin:0 0 16px;font-size:14px;color:#444">Show the QR code at the entrance, on your phone or printed. <a href="${e(calendar)}">Add it to your calendar</a>.</p>
<p style="margin:0 0 16px;padding:12px 14px;background:#f6f6f4;border-radius:8px;font-size:14px;color:#444">Can't come after all? <a href="${e(cancel)}" style="color:#111;font-weight:600">Cancel your ticket</a>, so someone else can have your place.</p>
<p style="margin:0">See you there,<br>${e(event.name)}</p>
</div></div></body></html>`;
  return { subject, text, html };
}

/** Emails tickets and records when they went out. Registrations without an email are skipped. */
export async function sendTickets(eventId: string, registrationIds: string[]) {
  if (!registrationIds.length) return 0;
  const [event, regs] = await Promise.all([
    prisma.event.findUniqueOrThrow({ where: { id: eventId } }),
    prisma.registration.findMany({ where: { id: { in: registrationIds }, eventId, status: "ACTIVE", NOT: { email: "" } }, include: { ticketType: { select: { name: true } } } }),
  ]);
  if (!regs.length) return 0;
  sendMailInBackground(regs.map((r) => ({ to: r.email, kind: "ticket", ...renderTicketEmail(event, r) })));
  await prisma.registration.updateMany({ where: { id: { in: regs.map((r) => r.id) } }, data: { ticketSentAt: new Date() } });
  return regs.length;
}
