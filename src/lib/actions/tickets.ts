"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clientIp } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/lib/dal";
import { nextStep, settingsPath } from "@/lib/event-setup";
import { eventAccessOrNull } from "@/lib/organizer";
import { consume } from "@/lib/rate-limit";
import { IMPORT_PLATFORMS } from "@/lib/registrant-import";
import { newTicketCode, registrationState, sendTickets } from "@/lib/tickets";
import { type ActionState, fieldErrors, formToObject } from "@/lib/validation";
import { isEventPublic } from "@/lib/domain";

const text = (max: number) => z.string().trim().max(max).default("");
const email = z.string().trim().toLowerCase().max(254).email("Enter a valid email address");
const optionalEmail = z.string().trim().toLowerCase().max(254).default("").refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address");
const optionalInt = z.string().trim().default("").transform((v, ctx) => {
  if (!v) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 1_000_000) {
    ctx.addIssue({ code: "custom", message: "A whole number above 0" });
    return z.NEVER;
  }
  return n;
});
const optionalDate = z.string().trim().default("").transform((v, ctx) => {
  if (!v) return null;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    ctx.addIssue({ code: "custom", message: "Invalid date" });
    return z.NEVER;
  }
  return d;
});
const checkbox = z.string().optional().transform((v) => v === "on");

function revalidateTickets(eventId: string, slug?: string) {
  revalidatePath(`/organize/${eventId}`, "layout");
  if (slug) revalidatePath(`/events/${slug}`);
}

// ─── Public: register for an event ───────────────────────────────────────────

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(150),
  email,
  company: text(150),
  jobTitle: text(150),
  ticketTypeId: text(64),
  shareWithSponsors: checkbox,
});

/**
 * Registers someone and emails their ticket. Registering an email that already has a ticket
 * re-sends that ticket instead. Both get the same answer and the ticket only goes to the inbox,
 * so the form can't be used to find out whether someone is attending.
 */
export async function registerForEvent(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const h = await headers();
  const ip = clientIp(h) || "unknown";
  const limit = await consume(`register:ip:${ip}`, { window: 3600, max: 30 });
  if (!limit.allowed) return { ok: false, message: "Too many registrations from this connection. Please try again later." };

  const parsed = registerSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };
  const input = parsed.data;
  const perEmail = await consume(`register:email:${input.email}`, { window: 3600, max: 5 });
  if (!perEmail.allowed) return { ok: false, message: "Too many attempts for this email address. Please try again later." };

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || !isEventPublic(event)) return { ok: false, message: "This event isn't taking registrations." };
  const active = await prisma.registration.count({ where: { eventId, status: "ACTIVE" } });

  const existing = await prisma.registration.findFirst({ where: { eventId, email: input.email }, orderBy: { createdAt: "desc" } });
  const done: ActionState = { ok: true, message: `You're registered. Your ticket with the QR code is on its way to ${input.email}. Not there in a few minutes? Check your spam folder.` };
  if (existing?.status === "ACTIVE") {
    await sendTickets(eventId, [existing.id]);
    return done;
  }

  const state = registrationState(event, active);
  if (state !== "open") {
    const why = { "not-open": "Registration isn't open.", closed: "Registration has closed.", full: "This event is full.", ended: "This event has ended." }[state];
    return { ok: false, message: why };
  }

  const types = await prisma.ticketType.findMany({ where: { eventId, published: true } });
  let ticketTypeId: string | null = null;
  if (types.length) {
    const type = types.find((t) => t.id === input.ticketTypeId);
    if (!type) return { ok: false, message: "Pick a ticket.", errors: { ticketTypeId: ["Pick a ticket"] } };
    if (type.capacity !== null) {
      const taken = await prisma.registration.count({ where: { ticketTypeId: type.id, status: "ACTIVE" } });
      if (taken >= type.capacity) return { ok: false, message: `${type.name} is sold out.`, errors: { ticketTypeId: ["Sold out"] } };
    }
    ticketTypeId = type.id;
  }

  const user = await getCurrentUser();
  const consent = event.sponsorSharingEnabled && input.shareWithSponsors;
  const data = {
    name: input.name, email: input.email, company: input.company, jobTitle: input.jobTitle, ticketTypeId,
    userId: user?.email.toLowerCase() === input.email ? user.id : null,
    shareWithSponsors: consent, consentAt: consent ? new Date() : null,
    status: "ACTIVE" as const, source: "SPEAKERDESK" as const, code: newTicketCode(), checkedInAt: null, ticketSentAt: null,
  };
  // Someone who cancelled earlier gets a fresh ticket on the same record.
  const reg = existing
    ? await prisma.registration.update({ where: { id: existing.id }, data })
    : await prisma.registration.create({ data: { ...data, eventId } });
  await sendTickets(eventId, [reg.id]);
  revalidateTickets(eventId, event.slug);
  return done;
}

/** The attendee cancels their own ticket. Holding the ticket link is the proof. */
export async function cancelOwnTicket(code: string): Promise<void> {
  const reg = await prisma.registration.findUnique({ where: { code }, include: { event: { select: { slug: true } } } });
  if (!reg || reg.status !== "ACTIVE" || reg.checkedInAt) return;
  await prisma.registration.update({ where: { id: reg.id }, data: { status: "CANCELLED" } });
  revalidateTickets(reg.eventId, reg.event.slug);
  revalidatePath(`/tickets/${code}`);
}

/** The attendee gives or withdraws consent for sponsor contact, from their ticket page. */
export async function setOwnSponsorConsent(code: string, allow: boolean): Promise<void> {
  const reg = await prisma.registration.findUnique({ where: { code }, include: { event: { select: { sponsorSharingEnabled: true } } } });
  if (!reg || (allow && !reg.event.sponsorSharingEnabled)) return;
  await prisma.registration.update({ where: { id: reg.id }, data: { shareWithSponsors: allow, consentAt: allow ? new Date() : null } });
  revalidatePath(`/tickets/${code}`);
  revalidatePath(`/organize/${reg.eventId}/tickets`);
}

// ─── Organizers: settings and ticket types ───────────────────────────────────

const settingsSchema = z.object({
  registrationOpen: checkbox,
  registrationCapacity: optionalInt,
  registrationClosesAt: optionalDate,
  registrationNote: text(500),
  sponsorSharingEnabled: checkbox,
});

export async function saveRegistrationSettings(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const access = await eventAccessOrNull(user, eventId, "ORGANIZER");
  if (!access) return { ok: false, message: "Only owners and co-organizers can change registration." };
  const parsed = settingsSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };
  await prisma.event.update({ where: { id: eventId }, data: parsed.data });
  revalidateTickets(eventId, access.event.slug);
  if (form.get("intent") === "continue") redirect(settingsPath(eventId, nextStep("registration") ?? "registration"));
  return { ok: true, message: parsed.data.registrationOpen ? "Saved. Registration is open on your event page." : "Saved." };
}

const typeSchema = z.object({
  name: z.string().trim().min(1, "Give the ticket a name").max(80),
  description: text(300),
  capacity: optionalInt,
  priceLabel: text(60),
  published: checkbox,
});

export async function addTicketType(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const access = await eventAccessOrNull(user, eventId, "ORGANIZER");
  if (!access) return { ok: false, message: "Only owners and co-organizers can change tickets." };
  const parsed = typeSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };
  const count = await prisma.ticketType.count({ where: { eventId } });
  if (count >= 20) return { ok: false, message: "An event can have up to 20 ticket types." };
  await prisma.ticketType.create({ data: { ...parsed.data, eventId, position: count } });
  revalidateTickets(eventId, access.event.slug);
  return { ok: true, message: `Added ${parsed.data.name}.` };
}

export async function updateTicketType(typeId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const type = await prisma.ticketType.findUnique({ where: { id: typeId } });
  const access = type && (await eventAccessOrNull(user, type.eventId, "ORGANIZER"));
  if (!type || !access) return { ok: false, message: "Ticket type not found." };
  const parsed = typeSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };
  await prisma.ticketType.update({ where: { id: typeId }, data: parsed.data });
  revalidateTickets(type.eventId, access.event.slug);
  return { ok: true, message: "Saved." };
}

/** Only ticket types nobody holds can be deleted; otherwise unpublish them. */
export async function deleteTicketType(typeId: string): Promise<void> {
  const user = await requireUser();
  const type = await prisma.ticketType.findUnique({ where: { id: typeId }, include: { _count: { select: { registrations: true } } } });
  const access = type && (await eventAccessOrNull(user, type.eventId, "ORGANIZER"));
  if (!type || !access || type._count.registrations > 0) return;
  await prisma.ticketType.delete({ where: { id: typeId } });
  revalidateTickets(type.eventId, access.event.slug);
}

// ─── Organizers: attendees ───────────────────────────────────────────────────

const manualSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(150),
  email: optionalEmail,
  company: text(150),
  jobTitle: text(150),
  ticketTypeId: text(64),
  sendTicket: checkbox,
});

/** Adds someone by hand (speakers, crew, guests). Unpublished ticket types are allowed here. */
export async function addRegistrant(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const access = await eventAccessOrNull(user, eventId, "ORGANIZER");
  if (!access) return { ok: false, message: "Only owners and co-organizers can add attendees." };
  const parsed = manualSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };
  const { sendTicket, ticketTypeId, ...data } = parsed.data;
  if (data.email && (await prisma.registration.count({ where: { eventId, email: data.email, status: "ACTIVE" } }))) {
    return { ok: false, message: "This email address already has a ticket.", errors: { email: ["Already registered"] } };
  }
  const type = ticketTypeId ? await prisma.ticketType.findFirst({ where: { id: ticketTypeId, eventId } }) : null;
  const reg = await prisma.registration.create({ data: { ...data, eventId, ticketTypeId: type?.id ?? null, source: "MANUAL", code: newTicketCode() } });
  const sent = sendTicket && data.email ? await sendTickets(eventId, [reg.id]) : 0;
  revalidateTickets(eventId, access.event.slug);
  return { ok: true, message: `Added ${data.name}.${sent ? " Their ticket is on its way." : ""}` };
}

const importSchema = z.object({
  platform: z.enum(IMPORT_PLATFORMS.map((p) => p.id) as [string, ...string[]]),
  ticketTypeId: z.string().max(64).default(""),
  rows: z
    .array(z.object({
      name: z.string().trim().min(1).max(150),
      email: optionalEmail,
      company: text(150),
      jobTitle: text(150),
    }))
    .min(1, "Nothing to import")
    .max(5000, "Import at most 5,000 people at a time"),
});

/**
 * Imports registrants from another platform's export (already mapped in the browser). People
 * already on the list (same email) are skipped. Imported people never count as having agreed to
 * sponsor sharing: they didn't see that question.
 */
export async function importRegistrants(eventId: string, payload: unknown): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const access = await eventAccessOrNull(user, eventId, "ORGANIZER");
  if (!access) return { ok: false, message: "Only owners and co-organizers can import attendees." };
  const parsed = importSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "That file couldn't be imported." };
  const { platform, ticketTypeId, rows } = parsed.data;
  const type = ticketTypeId ? await prisma.ticketType.findFirst({ where: { id: ticketTypeId, eventId } }) : null;

  const known = new Set((await prisma.registration.findMany({ where: { eventId, NOT: { email: "" } }, select: { email: true } })).map((r) => r.email));
  const fresh: typeof rows = [];
  for (const r of rows) {
    if (r.email && known.has(r.email)) continue;
    if (r.email) known.add(r.email);
    fresh.push(r);
  }
  await prisma.registration.createMany({
    data: fresh.map((r) => ({ ...r, eventId, ticketTypeId: type?.id ?? null, source: "IMPORT" as const, sourcePlatform: platform, code: newTicketCode() })),
  });
  revalidateTickets(eventId, access.event.slug);
  const skipped = rows.length - fresh.length;
  const noEmail = fresh.filter((r) => !r.email).length;
  return {
    ok: true,
    message: `Imported ${fresh.length} ${fresh.length === 1 ? "person" : "people"}.${skipped ? ` ${skipped} already had a ticket.` : ""}${noEmail ? ` ${noEmail} without an email address: check them in by name.` : ""} No tickets were emailed yet.`,
  };
}

/** Emails every ticket that hasn't been sent yet (imports, manual adds without email first). */
export async function emailPendingTickets(eventId: string): Promise<void> {
  const user = await requireUser();
  const access = await eventAccessOrNull(user, eventId, "ORGANIZER");
  if (!access) return;
  const pending = await prisma.registration.findMany({ where: { eventId, status: "ACTIVE", ticketSentAt: null, NOT: { email: "" } }, select: { id: true }, take: 5000 });
  await sendTickets(eventId, pending.map((p) => p.id));
  revalidateTickets(eventId);
}

export async function resendTicket(registrationId: string): Promise<void> {
  const user = await requireUser();
  const reg = await prisma.registration.findUnique({ where: { id: registrationId } });
  if (!reg || !(await eventAccessOrNull(user, reg.eventId, "ORGANIZER"))) return;
  await sendTickets(reg.eventId, [reg.id]);
  revalidateTickets(reg.eventId);
}

export async function setRegistrationCancelled(registrationId: string, cancelled: boolean): Promise<void> {
  const user = await requireUser();
  const reg = await prisma.registration.findUnique({ where: { id: registrationId }, include: { event: { select: { slug: true } } } });
  if (!reg || !(await eventAccessOrNull(user, reg.eventId, "ORGANIZER"))) return;
  await prisma.registration.update({ where: { id: reg.id }, data: { status: cancelled ? "CANCELLED" : "ACTIVE" } });
  revalidateTickets(reg.eventId, reg.event.slug);
}

/** Curation: leave someone out of the sponsor export even though they agreed to sharing. */
export async function setSponsorExclusion(registrationId: string, exclude: boolean): Promise<void> {
  const user = await requireUser();
  const reg = await prisma.registration.findUnique({ where: { id: registrationId } });
  if (!reg || !(await eventAccessOrNull(user, reg.eventId, "ORGANIZER"))) return;
  await prisma.registration.update({ where: { id: reg.id }, data: { excludeFromSponsorExport: exclude } });
  revalidateTickets(reg.eventId);
}

// ─── Check-in (any team member, so volunteers can run the door) ──────────────

export type CheckInResult =
  | { status: "checked-in" | "already"; name: string; ticket: string; at: string; id: string }
  | { status: "cancelled"; name: string; id: string }
  | { status: "unknown" | "denied" };

/** Accepts a ticket code or the full ticket URL from the QR code. */
export async function checkIn(eventId: string, scanned: string): Promise<CheckInResult> {
  const user = await requireUser();
  if (!(await eventAccessOrNull(user, eventId, "VOLUNTEER"))) return { status: "denied" };
  const code = scanned.trim().split("/tickets/").pop()?.split(/[/?#]/)[0] ?? "";
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(code)) return { status: "unknown" };
  return checkInWhere(eventId, user.id, { code });
}

export async function checkInById(eventId: string, registrationId: string): Promise<CheckInResult> {
  const user = await requireUser();
  if (!(await eventAccessOrNull(user, eventId, "VOLUNTEER"))) return { status: "denied" };
  return checkInWhere(eventId, user.id, { id: registrationId });
}

async function checkInWhere(eventId: string, userId: string, where: { code: string } | { id: string }): Promise<CheckInResult> {
  const reg = await prisma.registration.findFirst({ where: { ...where, eventId }, include: { ticketType: { select: { name: true } } } });
  if (!reg) return { status: "unknown" };
  if (reg.status === "CANCELLED") return { status: "cancelled", name: reg.name, id: reg.id };
  const ticket = reg.ticketType?.name ?? "General admission";
  if (reg.checkedInAt) return { status: "already", name: reg.name, ticket, at: reg.checkedInAt.toISOString(), id: reg.id };
  const now = new Date();
  // Only the first scan counts, even if two doors scan the same ticket at once.
  const updated = await prisma.registration.updateMany({ where: { id: reg.id, checkedInAt: null }, data: { checkedInAt: now, checkedInById: userId } });
  revalidatePath(`/organize/${eventId}/tickets`);
  if (!updated.count) return { status: "already", name: reg.name, ticket, at: now.toISOString(), id: reg.id };
  return { status: "checked-in", name: reg.name, ticket, at: now.toISOString(), id: reg.id };
}

export async function undoCheckIn(eventId: string, registrationId: string): Promise<void> {
  const user = await requireUser();
  if (!(await eventAccessOrNull(user, eventId, "VOLUNTEER"))) return;
  await prisma.registration.updateMany({ where: { id: registrationId, eventId }, data: { checkedInAt: null, checkedInById: null } });
  revalidatePath(`/organize/${eventId}/tickets`);
}
