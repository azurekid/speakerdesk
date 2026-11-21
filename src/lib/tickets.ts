import "server-only";
import { randomBytes } from "node:crypto";
import { formatDateRange } from "@/components/ui";
import { appUrl } from "@/lib/app-url";
import { prisma } from "@/lib/db";
import { eventWhere } from "@/lib/domain";
import { escapeHtml, mailLayout } from "@/lib/email-template";
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

type TicketMailEvent = { name: string; slug: string; startDate: Date | null; endDate: Date | null; venue: string; address: string; location: string; format: "IN_PERSON" | "ONLINE" | "HYBRID"; onlinePlatform: string };
type TicketMailRegistration = { code: string; name: string; email: string; ticketType: { name: string } | null };

/** The ticket email: QR code, the essentials, and links to the ticket and the calendar file. */
export function renderTicketEmail(event: TicketMailEvent, r: TicketMailRegistration) {
  const when = formatDateRange(event.startDate, event.endDate);
  const where = (event.format === "ONLINE" ? `Online${event.onlinePlatform ? ` (${event.onlinePlatform})` : ""}` : [event.venue, event.address || eventWhere(event)].filter(Boolean).join(", ")) || "To be announced";
  const first = r.name.split(" ")[0];
  const subject = `Your ticket for ${event.name}`;
  const text = `Hi ${first},

You're registered for ${event.name}.

When: ${when}
Where: ${where}
Ticket: ${r.ticketType?.name ?? "General admission"}

Show the QR code on your ticket at the entrance (on your phone or printed):
${ticketUrl(r.code)}

Add it to your calendar: ${appUrl()}/events/${event.slug}/calendar.ics
Can't come after all? Cancel from your ticket page, so someone else can have your place.

See you there,
${event.name}`;
  const html = mailLayout(`
<p style="margin:0 0 16px">Hi ${escapeHtml(first)},</p>
<p style="margin:0 0 16px">You're registered for <strong>${escapeHtml(event.name)}</strong>.</p>
<p style="margin:0 0 16px;text-align:center"><img src="${escapeHtml(qrUrl(r.code))}" width="220" height="220" alt="Your ticket QR code" style="display:inline-block;border:8px solid #fff"></p>
<table style="margin:0 0 16px;border-collapse:collapse;font-size:14px">
<tr><td style="padding:2px 12px 2px 0;color:#666">When</td><td>${escapeHtml(when)}</td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#666">Where</td><td>${escapeHtml(where)}</td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#666">Ticket</td><td>${escapeHtml(r.ticketType?.name ?? "General admission")}</td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#666">Name</td><td>${escapeHtml(r.name)}</td></tr>
</table>
<p style="margin:0 0 16px"><a href="${escapeHtml(ticketUrl(r.code))}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Open your ticket</a></p>
<p style="margin:0 0 16px;font-size:14px;color:#444">Show the QR code at the entrance, on your phone or printed. <a href="${escapeHtml(`${appUrl()}/events/${event.slug}/calendar.ics`)}">Add it to your calendar</a>.</p>
<p style="margin:0 0 16px;font-size:14px;color:#444">Can't come after all? Cancel from your ticket page, so someone else can have your place.</p>
<p style="margin:0">See you there,<br>${escapeHtml(event.name)}</p>`);
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
