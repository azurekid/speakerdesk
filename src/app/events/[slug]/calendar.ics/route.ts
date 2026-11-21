import { prisma } from "@/lib/db";
import { buildCalendar, icsResponse } from "@/lib/ics";
import { eventCalendarEvent, getSchedule, sessionCalendarEvents } from "@/lib/schedule-queries";
import { isEventPublic } from "@/lib/domain";

/**
 * Public calendar file for an event: the event itself plus, once the schedule is published,
 * every scheduled session. `?session=<id>` gives just that one session.
 */
export async function GET(request: Request, { params }: RouteContext<"/events/[slug]/calendar.ics">) {
  const { slug } = await params;
  const event = await prisma.event.findUnique({ where: { slug }, select: { id: true, cfpPublished: true, programPublished: true, registrationOpen: true } });
  if (!event || !isEventPublic(event)) return new Response("Not found", { status: 404 });

  const data = await getSchedule(event.id, { publicOnly: true });
  const sessions = data.event.schedulePublished ? sessionCalendarEvents(data) : [];
  const only = new URL(request.url).searchParams.get("session");
  if (only) {
    const one = sessions.filter((s) => s.uid === `session-${only}`);
    if (!one.length) return new Response("Not found", { status: 404 });
    return icsResponse(buildCalendar(data.event.name, one), `${slug}-session.ics`);
  }
  const whole = eventCalendarEvent(data.event);
  return icsResponse(buildCalendar(data.event.name, [...(whole ? [whole] : []), ...sessions]), `${slug}.ics`);
}
