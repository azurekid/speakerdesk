import "server-only";
import { prisma } from "@/lib/db";
import { eventWhere } from "@/lib/domain";
import type { IcsEvent } from "@/lib/ics";
import { appUrl } from "@/lib/app-url";
import { dayKey, eventDays, formatRange, slotSignature, zonedInstant } from "@/lib/schedule";

export type ScheduleSession = {
  id: string;
  title: string;
  abstract: string;
  track: string;
  format: string;
  durationMinutes: number;
  speakerId: string;
  speakerName: string;
  confirmation: "PENDING" | "CONFIRMED" | "DECLINED" | null;
  decisionPublished: boolean;
  day: string | null;
  start: number | null;
  end: number | null;
  roomId: string | null;
};

export type ScheduleData = Awaited<ReturnType<typeof getSchedule>>;

/**
 * Everything the schedule needs: the event's days, rooms, breaks, and its accepted sessions
 * (placed or not). Sessions whose speaker declined are left out. With `publicOnly`, only
 * decisions already sent to speakers count.
 */
export async function getSchedule(eventId: string, { publicOnly = false } = {}) {
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
  const [rooms, items, proposals] = await Promise.all([
    prisma.scheduleRoom.findMany({ where: { eventId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    prisma.scheduleItem.findMany({ where: { eventId }, orderBy: [{ day: "asc" }, { startMinute: "asc" }] }),
    prisma.proposal.findMany({
      where: {
        eventId, decision: "ACCEPTED", withdrawn: false,
        OR: [{ confirmation: null }, { confirmation: { not: "DECLINED" } }],
        ...(publicOnly ? { decisionPublished: true } : {}),
      },
      include: { speaker: { select: { name: true, profile: { select: { fullName: true } } } } },
      orderBy: [{ track: "asc" }, { title: "asc" }],
    }),
  ]);
  const days = eventDays(event.startDate, event.endDate);
  const sessions: ScheduleSession[] = proposals.map((p) => {
    const placed = p.slotDay && p.slotStart !== null && days.includes(dayKey(p.slotDay));
    return {
      id: p.id, title: p.title, abstract: p.abstract, track: p.track, format: p.format, durationMinutes: p.durationMinutes,
      speakerId: p.speakerId, speakerName: p.speaker.profile?.fullName || p.speaker.name,
      confirmation: p.confirmation, decisionPublished: p.decisionPublished,
      day: placed ? dayKey(p.slotDay!) : null,
      start: placed ? p.slotStart : null,
      end: placed ? p.slotStart! + p.durationMinutes : null,
      roomId: placed ? p.roomId : null,
    };
  });
  return {
    event,
    days,
    rooms: rooms.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity })),
    items: items
      .filter((i) => days.includes(dayKey(i.day)))
      .map((i) => ({ id: i.id, title: i.title, day: dayKey(i.day), start: i.startMinute, end: i.endMinute, roomId: i.roomId })),
    sessions,
  };
}

/** Calendar entries for scheduled sessions (optionally one session only). */
export function sessionCalendarEvents(data: ScheduleData, only?: string): IcsEvent[] {
  const { event, rooms } = data;
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  const where = eventWhere(event);
  return data.sessions
    .filter((s) => s.day && s.start !== null && (!only || s.id === only))
    .map((s) => ({
      uid: `session-${s.id}`,
      title: `${s.title} (${s.speakerName})`,
      description: `${event.name}${s.track ? ` · ${s.track}` : ""}\n${formatRange(s.start!, s.end!)} ${event.timezone}\n\n${s.abstract}`.slice(0, 2000),
      location: [s.roomId && roomName.get(s.roomId), event.format !== "ONLINE" && event.venue, where].filter(Boolean).join(", "),
      url: `${appUrl()}/events/${event.slug}#session-${s.id}`,
      start: zonedInstant(s.day!, s.start!, event.timezone),
      end: zonedInstant(s.day!, s.end!, event.timezone),
    }));
}

/** The event itself, as an all-day entry spanning its dates. */
export function eventCalendarEvent(event: ScheduleData["event"]): IcsEvent | null {
  if (!event.startDate) return null;
  return {
    uid: `event-${event.id}`,
    title: event.name,
    description: [event.tagline, `${appUrl()}/events/${event.slug}`].filter(Boolean).join("\n\n"),
    location: [event.format !== "ONLINE" && event.venue, event.format !== "ONLINE" && event.address, eventWhere(event)].filter(Boolean).join(", "),
    url: `${appUrl()}/events/${event.slug}`,
    start: event.startDate,
    end: event.endDate && event.endDate >= event.startDate ? event.endDate : event.startDate,
    allDay: true,
  };
}

/**
 * Speakers whose slot is new or changed since we last told them (confirmed or still deciding;
 * only decisions already sent count).
 */
export async function slotsToAnnounce(eventId: string) {
  const data = await getSchedule(eventId, { publicOnly: true });
  const roomName = new Map(data.rooms.map((r) => [r.id, r.name]));
  const notified = new Map(
    (await prisma.proposal.findMany({ where: { id: { in: data.sessions.map((s) => s.id) } }, select: { id: true, slotNotified: true } })).map((p) => [p.id, p.slotNotified]),
  );
  return data.sessions
    .filter((s) => s.day && s.start !== null)
    .map((s) => ({ session: s, room: (s.roomId && roomName.get(s.roomId)) || "", signature: slotSignature({ day: s.day!, start: s.start!, end: s.end!, room: (s.roomId && roomName.get(s.roomId)) || "" }) }))
    .filter((x) => notified.get(x.session.id) !== x.signature);
}

