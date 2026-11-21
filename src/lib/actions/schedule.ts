"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { sendMailInBackground } from "@/lib/mailer";
import { appUrl, eventAccessOrNull } from "@/lib/organizer";
import { dayFromKey, eventDays, formatDayLabel, formatRange, isValidTimeZone, parseTime } from "@/lib/schedule";
import { slotsToAnnounce } from "@/lib/schedule-queries";
import type { ActionState } from "@/lib/validation";

const MAX_ROOMS = 30;
const MAX_ITEMS = 200;

async function organizerAccess(eventId: string) {
  const user = await requireUser();
  return eventAccessOrNull(user, eventId, "ORGANIZER");
}

function revalidateSchedule(eventId: string, slug: string) {
  revalidatePath(`/organize/${eventId}`, "layout");
  revalidatePath(`/events/${slug}`);
  revalidatePath("/submissions", "layout");
}

const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

// ─── Rooms and time zone ─────────────────────────────────────────────────────

export async function addRoom(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await organizerAccess(eventId);
  if (!access) return { ok: false, message: "Only owners and co-organizers can change the schedule." };
  const name = field(form, "name").slice(0, 80);
  if (!name) return { ok: false, message: "Give the room a name.", errors: { name: ["Required"] } };
  const capacityRaw = field(form, "capacity");
  const capacity = capacityRaw ? Math.max(0, Math.min(100_000, Math.round(Number(capacityRaw)) || 0)) : null;
  const count = await prisma.scheduleRoom.count({ where: { eventId } });
  if (count >= MAX_ROOMS) return { ok: false, message: `An event can have up to ${MAX_ROOMS} rooms.` };
  await prisma.scheduleRoom.create({ data: { eventId, name, capacity, position: count } });
  revalidateSchedule(eventId, access.event.slug);
  return { ok: true, message: `Added ${name}.` };
}

export async function renameRoom(roomId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const room = await prisma.scheduleRoom.findUnique({ where: { id: roomId } });
  const access = room && (await organizerAccess(room.eventId));
  if (!room || !access) return { ok: false, message: "Room not found." };
  const name = field(form, "name").slice(0, 80);
  if (!name) return { ok: false, message: "Give the room a name." };
  await prisma.scheduleRoom.update({ where: { id: roomId }, data: { name } });
  revalidateSchedule(room.eventId, access.event.slug);
  return { ok: true, message: "Saved." };
}

/** Sessions in the room go back to "unscheduled"; breaks in it are removed. */
export async function deleteRoom(roomId: string): Promise<void> {
  const room = await prisma.scheduleRoom.findUnique({ where: { id: roomId } });
  const access = room && (await organizerAccess(room.eventId));
  if (!room || !access) return;
  await prisma.$transaction([
    prisma.proposal.updateMany({ where: { roomId }, data: { slotDay: null, slotStart: null, roomId: null } }),
    prisma.scheduleRoom.delete({ where: { id: roomId } }),
  ]);
  revalidateSchedule(room.eventId, access.event.slug);
}

export async function moveRoom(roomId: string, direction: -1 | 1): Promise<void> {
  const room = await prisma.scheduleRoom.findUnique({ where: { id: roomId } });
  const access = room && (await organizerAccess(room.eventId));
  if (!room || !access) return;
  const rooms = await prisma.scheduleRoom.findMany({ where: { eventId: room.eventId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  const i = rooms.findIndex((r) => r.id === roomId);
  const j = i + direction;
  if (j < 0 || j >= rooms.length) return;
  [rooms[i], rooms[j]] = [rooms[j], rooms[i]];
  await prisma.$transaction(rooms.map((r, position) => prisma.scheduleRoom.update({ where: { id: r.id }, data: { position } })));
  revalidateSchedule(room.eventId, access.event.slug);
}

export async function setTimezone(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await organizerAccess(eventId);
  if (!access) return { ok: false, message: "Only owners and co-organizers can change the schedule." };
  const timezone = field(form, "timezone");
  if (!isValidTimeZone(timezone)) return { ok: false, message: "Pick a time zone from the list.", errors: { timezone: ["Unknown time zone"] } };
  await prisma.event.update({ where: { id: eventId }, data: { timezone } });
  revalidateSchedule(eventId, access.event.slug);
  return { ok: true, message: `Times are now in ${timezone}.` };
}

// ─── Placing sessions and breaks ─────────────────────────────────────────────

type Placement = { day: string; start: number; roomId: string | null };

/** Checks a placement against the event's days and rooms. Returns an error message or null. */
async function checkPlacement(event: { id: string; startDate: Date | null; endDate: Date | null }, p: Placement, length: number) {
  if (!eventDays(event.startDate, event.endDate).includes(p.day)) return "Pick one of the event's days.";
  if (!Number.isInteger(p.start) || p.start < 0 || p.start + length > 24 * 60) return "That time doesn't fit in the day.";
  if (p.roomId && !(await prisma.scheduleRoom.count({ where: { id: p.roomId, eventId: event.id } }))) return "Pick one of the event's rooms.";
  return null;
}

/** Places (or moves) an accepted session. Called by drag and drop and by the place form. */
export async function placeSession(eventId: string, proposalId: string, day: string, start: number, roomId: string): Promise<{ ok: boolean; message?: string }> {
  const access = await organizerAccess(eventId);
  if (!access) return { ok: false, message: "Only owners and co-organizers can change the schedule." };
  const proposal = await prisma.proposal.findFirst({ where: { id: proposalId, eventId, decision: "ACCEPTED", withdrawn: false } });
  if (!proposal || proposal.confirmation === "DECLINED") return { ok: false, message: "Only accepted sessions can be scheduled." };
  const problem = await checkPlacement(access.event, { day, start, roomId }, proposal.durationMinutes);
  if (problem) return { ok: false, message: problem };
  if (!roomId) return { ok: false, message: "Pick a room." };
  await prisma.proposal.update({ where: { id: proposalId }, data: { slotDay: dayFromKey(day), slotStart: start, roomId } });
  revalidateSchedule(eventId, access.event.slug);
  return { ok: true };
}

/** Form version of placeSession, for phones and keyboards. */
export async function placeSessionForm(eventId: string, proposalId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const start = parseTime(field(form, "start"));
  if (start === null) return { ok: false, message: "Enter a start time like 09:30.", errors: { start: ["Use HH:MM"] } };
  const r = await placeSession(eventId, proposalId, field(form, "day"), start, field(form, "roomId"));
  return { ok: r.ok, message: r.message ?? "Scheduled." };
}

export async function unscheduleSession(eventId: string, proposalId: string): Promise<void> {
  const access = await organizerAccess(eventId);
  if (!access) return;
  await prisma.proposal.updateMany({ where: { id: proposalId, eventId }, data: { slotDay: null, slotStart: null, roomId: null } });
  revalidateSchedule(eventId, access.event.slug);
}

export async function addScheduleItem(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await organizerAccess(eventId);
  if (!access) return { ok: false, message: "Only owners and co-organizers can change the schedule." };
  const title = field(form, "title").slice(0, 120);
  const start = parseTime(field(form, "start"));
  const end = parseTime(field(form, "end"));
  const errors: Record<string, string[]> = {};
  if (!title) errors.title = ["Required"];
  if (start === null) errors.start = ["Use HH:MM"];
  if (end === null) errors.end = ["Use HH:MM"];
  else if (start !== null && end <= start) errors.end = ["Must be after the start"];
  if (Object.keys(errors).length) return { ok: false, message: "Please fix the highlighted fields.", errors };
  const roomId = field(form, "roomId") || null;
  const problem = await checkPlacement(access.event, { day: field(form, "day"), start: start!, roomId }, end! - start!);
  if (problem) return { ok: false, message: problem };
  if ((await prisma.scheduleItem.count({ where: { eventId } })) >= MAX_ITEMS) return { ok: false, message: `A schedule can have up to ${MAX_ITEMS} breaks and other items.` };
  await prisma.scheduleItem.create({ data: { eventId, title, day: dayFromKey(field(form, "day")), startMinute: start!, endMinute: end!, roomId } });
  revalidateSchedule(eventId, access.event.slug);
  return { ok: true, message: `Added ${title}.` };
}

/** Drag and drop for breaks: keeps the length, changes day/time (and room unless it spans all). */
export async function moveScheduleItem(eventId: string, itemId: string, day: string, start: number, roomId: string): Promise<{ ok: boolean; message?: string }> {
  const access = await organizerAccess(eventId);
  if (!access) return { ok: false, message: "Only owners and co-organizers can change the schedule." };
  const item = await prisma.scheduleItem.findFirst({ where: { id: itemId, eventId } });
  if (!item) return { ok: false, message: "Item not found." };
  const length = item.endMinute - item.startMinute;
  const nextRoom = item.roomId === null ? null : roomId;
  const problem = await checkPlacement(access.event, { day, start, roomId: nextRoom }, length);
  if (problem) return { ok: false, message: problem };
  await prisma.scheduleItem.update({ where: { id: itemId }, data: { day: dayFromKey(day), startMinute: start, endMinute: start + length, roomId: nextRoom } });
  revalidateSchedule(eventId, access.event.slug);
  return { ok: true };
}

export async function deleteScheduleItem(eventId: string, itemId: string): Promise<void> {
  const access = await organizerAccess(eventId);
  if (!access) return;
  await prisma.scheduleItem.deleteMany({ where: { id: itemId, eventId } });
  revalidateSchedule(eventId, access.event.slug);
}

// ─── Publishing ──────────────────────────────────────────────────────────────

/** Emails speakers their new or changed slot, and remembers what we told them. */
async function announceSlots(event: { id: string; name: string; slug: string; timezone: string }) {
  const changes = await slotsToAnnounce(event.id);
  if (!changes.length) return 0;
  const speakers = new Map(
    (await prisma.proposal.findMany({ where: { id: { in: changes.map((c) => c.session.id) } }, select: { id: true, submissionId: true, slotNotified: true, speaker: { select: { email: true } } } })).map((p) => [p.id, p]),
  );
  sendMailInBackground(changes.flatMap(({ session: s, room }) => {
    const p = speakers.get(s.id);
    if (!p) return [];
    const when = `${formatDayLabel(s.day!)}, ${formatRange(s.start!, s.end!)} (${event.timezone})${room ? `, ${room}` : ""}`;
    const link = p.submissionId ? `${appUrl()}/submissions/${p.submissionId}/edit` : `${appUrl()}/events/${event.slug}`;
    return [{
      to: p.speaker.email,
      kind: "schedule-slot",
      subject: `${event.name}: ${p.slotNotified ? "your time slot changed" : "your time slot"} for “${s.title}”`,
      text: `Hi ${s.speakerName.split(" ")[0]},\n\n${p.slotNotified ? "Your session has moved. The new time is:" : "Your session is on the schedule:"}\n\n${s.title}\n${when}\n\nAdd it to your calendar: ${appUrl()}/events/${event.slug}/calendar.ics?session=${s.id}\nYour session page: ${link}\n\nSee you there,\n${event.name}`,
    }];
  }));
  await prisma.$transaction(changes.map((c) => prisma.proposal.update({ where: { id: c.session.id }, data: { slotNotified: c.signature } })));
  return changes.length;
}

/** Publishing the schedule also publishes the programme and tells speakers their slot. */
export async function publishSchedule(eventId: string, publish: boolean): Promise<void> {
  const access = await organizerAccess(eventId);
  if (!access) return;
  await prisma.event.update({ where: { id: eventId }, data: publish ? { schedulePublished: true, programPublished: true } : { schedulePublished: false } });
  if (publish) await announceSlots(access.event);
  revalidateSchedule(eventId, access.event.slug);
}

export async function sendScheduleUpdates(eventId: string): Promise<void> {
  const access = await organizerAccess(eventId);
  if (!access || !access.event.schedulePublished) return;
  await announceSlots(access.event);
  revalidateSchedule(eventId, access.event.slug);
}
