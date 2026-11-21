import "server-only";
import { prisma } from "@/lib/db";

/**
 * The step-by-step setup guide on an event's overview. Every step is detected from the event's
 * own data, so it ticks itself off as the team works; nobody has to check boxes.
 */
export type GuideStep = {
  id: string;
  title: string;
  /** Why this step matters, in one or two sentences. */
  why: string;
  /** What to do, as short instructions. */
  how: string[];
  href: string;
  cta: string;
  optional?: boolean;
  done: boolean;
};

export async function getSetupGuide(eventId: string, userId: string) {
  const [event, members, proposals, rooms, tasks, awards, packages, me, registrations] = await Promise.all([
    prisma.event.findUniqueOrThrow({ where: { id: eventId } }),
    prisma.eventMember.count({ where: { eventId } }),
    prisma.proposal.findMany({
      where: { eventId, withdrawn: false },
      select: { decision: true, decisionPublished: true, confirmation: true, slotStart: true, _count: { select: { reviews: true } } },
    }),
    prisma.scheduleRoom.count({ where: { eventId } }),
    prisma.runbookTask.count({ where: { eventId } }),
    prisma.badgeAward.count({ where: { eventId } }),
    prisma.sponsorPackage.count({ where: { eventId, published: true } }),
    prisma.eventMember.findUnique({ where: { eventId_userId: { eventId, userId } }, select: { guideHidden: true } }),
    prisma.registration.count({ where: { eventId } }),
  ]);
  const base = `/organize/${eventId}`;
  const accepted = proposals.filter((p) => p.decision === "ACCEPTED" && p.confirmation !== "DECLINED");
  const decided = proposals.filter((p) => p.decision !== "UNDECIDED");

  const steps: GuideStep[] = [
    {
      id: "basics",
      title: "Add the essentials",
      why: "Dates, place and a short description are the first things speakers look at, and the dates drive the runbook and the schedule.",
      how: ["Set the start and end dates", event.format === "ONLINE" ? "Name the online platform" : "Add the venue (pick it on the map)", "Write a few lines about the event and pick a cover photo"],
      href: `${base}/settings`,
      cta: "Open settings",
      done: Boolean(event.startDate && event.description.trim() && (event.format === "ONLINE" || event.venue || event.location)),
    },
    {
      id: "cfp",
      title: "Shape your call for papers",
      why: "Clear rules get you proposals that fit: the right formats, the right tracks and abstracts of a usable length.",
      how: ["Set when the CfP opens and closes", "Add your tracks and the session formats you accept", "Write what you're looking for (topics, level, audience)"],
      href: `${base}/settings/cfp`,
      cta: "Set up the CfP",
      done: Boolean(event.cfpClosesAt && (event.tracks.length || event.formats.length || event.cfpGuidelines.trim())),
    },
    {
      id: "team",
      title: "Invite your team",
      why: "Reviews go faster with a committee, and volunteers can pick up runbook tasks. Each role only sees what it needs.",
      how: ["Invite co-organizers to run the event with you", "Add reviewers to score proposals (blind review is a setting)", "Add volunteers for the runbook"],
      href: `${base}/team`,
      cta: "Invite people",
      optional: true,
      done: members > 1,
    },
    {
      id: "publish-cfp",
      title: "Publish your call for papers",
      why: "Publishing lists the event under open calls on SpeakerDesk and gives you a public page to share.",
      how: ["Press Publish CfP on this overview", "Share the public link: there are share buttons for LinkedIn, X, Bluesky and more", "Speakers get a confirmation email when they submit (editable in Settings)"],
      href: `${base}#cfp`,
      cta: "Go to the CfP card",
      done: event.cfpPublished,
    },
    {
      id: "registration",
      title: "Open registration",
      why: "Attendees register on your event page and get a ticket with a QR code. Already using Meetup or run.events? Import that list instead, and everyone still gets a ticket for the door.",
      how: ["Add ticket types if you need them (days, students, crew)", "Set a maximum number of attendees", "Decide whether to ask attendees if sponsors may contact them", "Open registration, or import attendees on the Tickets tab"],
      href: `${base}/settings/registration`,
      cta: "Set up registration",
      optional: true,
      done: event.registrationOpen || registrations > 0,
    },
    {
      id: "review",
      title: "Review the proposals",
      why: "Scores from your team make the shortlist easy to defend, and averages sort the waitlist for you.",
      how: ["Open each proposal and give it a score from 1 to 5, with a comment", "Filter by track to share the work", "Proposals you haven't scored show up under Needs your review"],
      href: `${base}/proposals`,
      cta: "Open proposals",
      done: proposals.length > 0 && proposals.every((p) => p._count.reviews > 0),
    },
    {
      id: "decide",
      title: "Decide and tell the speakers",
      why: "Speakers are waiting to plan travel. Accepted speakers are asked to confirm, so you know who is really coming.",
      how: ["Accept, waitlist or reject each proposal", "Check the decision emails in Settings, under Emails", "Press Publish decisions: speakers get an email and see it in their tracker"],
      href: `${base}/proposals`,
      cta: "Make decisions",
      done: decided.length > 0 && decided.every((p) => p.decisionPublished) && proposals.every((p) => p.decision !== "UNDECIDED"),
    },
    {
      id: "schedule",
      title: "Build the schedule",
      why: "A timetable turns a list of talks into a programme attendees can plan their day around.",
      how: ["Add your rooms (stages, workshop rooms, online channels)", "Drag accepted sessions onto the grid, or tap one to pick a time", "Add breaks and lunch, and fix any clashes it flags"],
      href: `${base}/schedule`,
      cta: "Open the schedule",
      done: rooms > 0 && accepted.length > 0 && accepted.every((p) => p.slotStart !== null),
    },
    {
      id: "publish-schedule",
      title: "Publish the programme and schedule",
      why: "Your event page shows the timetable, attendees can add sessions to their calendar, and each speaker gets an email with their slot.",
      how: ["Press Publish schedule on the Schedule tab", "Moved something later? Send the slot updates from the same tab"],
      href: `${base}/schedule`,
      cta: "Publish the schedule",
      done: event.schedulePublished,
    },
    {
      id: "sponsors",
      title: "Open sponsorship",
      why: "Sponsors can compare your packages and request one in a few clicks, and every deal counts towards your budget.",
      how: ["Set a budget target", "Create packages and add-ons, then publish the prospectus", "Approve requests and track them to paid"],
      href: `${base}/sponsors`,
      cta: "Set up sponsors",
      optional: true,
      done: event.sponsorshipOpen && packages > 0,
    },
    {
      id: "runbook",
      title: "Plan with the runbook",
      why: "A to-do list planned back from your event date, so nothing gets forgotten. Some tasks tick themselves off.",
      how: ["Start from the standard conference runbook", "Assign owners and due dates", "Watch the health bar to see if you're on track"],
      href: `${base}/runbook`,
      cta: "Open the runbook",
      optional: true,
      done: tasks > 0,
    },
    {
      id: "badges",
      title: "Thank your speakers with badges",
      why: "After the event, a badge is a nice thank-you that speakers can show on their profile and share.",
      how: ["Pick a ready-made badge like Speaker or Top-rated session, or create your own", "Award it to accepted speakers and your team"],
      href: `${base}/badges`,
      cta: "Award badges",
      optional: true,
      done: awards > 0,
    },
  ];

  const essentials = steps.filter((s) => !s.optional);
  return {
    steps,
    hidden: me?.guideHidden ?? false,
    current: essentials.find((s) => !s.done) ?? steps.find((s) => !s.done) ?? null,
    essentialsDone: essentials.filter((s) => s.done).length,
    essentialsTotal: essentials.length,
  };
}
