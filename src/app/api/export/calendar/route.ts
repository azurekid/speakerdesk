import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { buildCalendar, type IcsEvent, icsResponse } from "@/lib/ics";
import { getSchedule, sessionCalendarEvents } from "@/lib/schedule-queries";

/**
 * The signed-in speaker's speaking calendar: their scheduled sessions at SpeakerDesk events
 * (with exact times), and every other accepted talk in their tracker as an all-day entry.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const entries: IcsEvent[] = [];
  const timed = new Set<string>(); // submission ids already covered by an exact slot

  const proposals = await prisma.proposal.findMany({
    where: { speakerId: user.id, decision: "ACCEPTED", decisionPublished: true, withdrawn: false, confirmation: { not: "DECLINED" }, event: { schedulePublished: true } },
    select: { id: true, eventId: true, submissionId: true },
  });
  for (const eventId of new Set(proposals.map((p) => p.eventId))) {
    const mine = proposals.filter((p) => p.eventId === eventId);
    const data = await getSchedule(eventId, { publicOnly: true });
    for (const p of mine) {
      const slot = sessionCalendarEvents(data, p.id);
      if (slot.length && p.submissionId) timed.add(p.submissionId);
      entries.push(...slot);
    }
  }

  const accepted = await prisma.submission.findMany({
    where: { userId: user.id, status: "ACCEPTED", eventStart: { not: null } },
    include: { talk: { select: { title: true } } },
  });
  for (const s of accepted) {
    if (timed.has(s.id)) continue;
    entries.push({
      uid: `submission-${s.id}`,
      title: `Speaking: ${s.eventName}${s.talk ? ` (${s.talk.title})` : ""}`,
      location: s.location,
      url: s.eventUrl || undefined,
      start: s.eventStart!,
      end: s.eventEnd && s.eventEnd >= s.eventStart! ? s.eventEnd : s.eventStart!,
      allDay: true,
    });
  }
  return icsResponse(buildCalendar("My speaking calendar", entries), "speakerdesk-speaking.ics");
}
