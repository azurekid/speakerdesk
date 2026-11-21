"use client";

import { usePathname } from "next/navigation";
import { PageTip } from "@/components/organizer/page-tip";

/** One tip per event workspace tab, shown on the tab's main page only (not on sub-pages). */
const TIPS: Record<string, { title: string; body: React.ReactNode }> = {
  runbook: {
    title: "The runbook is your event's to-do list",
    body: (
      <ul>
        <li>Start from the standard conference runbook: 24 tasks planned back from your event date.</li>
        <li>Assign each task to someone on the team; they can update their own tasks.</li>
        <li>Tasks with an automatic check tick themselves off, for example when you publish the CfP or reach your budget.</li>
      </ul>
    ),
  },
  proposals: {
    title: "Review and decide here",
    body: (
      <ul>
        <li>Open a proposal to read it and give a score from 1 to 5. Filter by track or decision, and sort by score.</li>
        <li>Organizers set a decision on each proposal: accept, waitlist or reject.</li>
        <li>Nothing reaches speakers until you press <strong>Publish decisions</strong> on the Overview. Then each speaker gets an email.</li>
      </ul>
    ),
  },
  program: {
    title: "Your programme, as it takes shape",
    body: (
      <ul>
        <li>Accepted sessions by track, with each speaker&apos;s confirmation and your waitlist (highest score first).</li>
        <li>Invite well-known speakers directly from the SpeakerDesk directory.</li>
        <li>The production checklist sums up what speakers need on stage, for your AV team.</li>
      </ul>
    ),
  },
  schedule: {
    title: "Build the timetable",
    body: (
      <ul>
        <li>Add your rooms first, and check the time zone.</li>
        <li>Drag a session from &quot;Not scheduled yet&quot; onto the grid, or tap it to type a time. Drag again to move it.</li>
        <li>Clashes (same room, or same speaker twice at once) are outlined in red.</li>
        <li><strong>Publish schedule</strong> shows it on your event page and emails every speaker their slot.</li>
      </ul>
    ),
  },
  sponsors: {
    title: "Sponsorship and budget",
    body: (
      <ul>
        <li>Set your budget target, then create packages (tiers) and add-ons, and publish the prospectus.</li>
        <li>Sponsors request packages; you approve them and track each deal from confirmed to invoiced to paid.</li>
        <li>Confirmed deals count towards the budget bar, and each sponsor has a deliverables checklist.</li>
      </ul>
    ),
  },
  team: {
    title: "Who helps run this event",
    body: (
      <ul>
        <li>Co-organizers run the event with you; reviewers score proposals; volunteers see the runbook.</li>
        <li>Invitations go by email and expire after 14 days. The table below shows exactly what each role can do.</li>
      </ul>
    ),
  },
  badges: {
    title: "Say thank you with badges",
    body: (
      <ul>
        <li>Use a ready-made badge (Speaker, Keynote speaker, Top-rated session and more) or create your own.</li>
        <li>Award it to accepted speakers and your team. They accept it first, then choose whether it shows on their profile.</li>
      </ul>
    ),
  },
  settings: {
    title: "Set up your event, one step at a time",
    body: (
      <ul>
        <li>Five steps on the left: details, banner, call for papers, registration and emails. A tick means a step is done.</li>
        <li>&quot;Save and continue&quot; takes you to the next step. You can come back to any step later.</li>
        <li>Nothing is public until you publish the CfP or open registration.</li>
      </ul>
    ),
  },
  tickets: {
    title: "Attendees, tickets and the door",
    body: (
      <ul>
        <li>Everyone who registers on your event page gets a ticket with a QR code by email.</li>
        <li>Import people who signed up on Meetup or run.events, then email them their tickets with one click.</li>
        <li>At the event, open <strong>Check in at the door</strong> on any phone: scan tickets, or search by name.</li>
        <li>The sponsor export only includes attendees who agreed to be contacted.</li>
      </ul>
    ),
  },
};

export function WorkspaceTip({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const tab = pathname.slice(`/organize/${eventId}/`.length);
  const tip = TIPS[tab];
  if (!pathname.startsWith(`/organize/${eventId}/`) || !tip) return null;
  return <PageTip id={`event-${tab}`} title={tip.title}>{tip.body}</PageTip>;
}
