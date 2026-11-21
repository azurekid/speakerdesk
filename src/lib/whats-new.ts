// The "What's new" page (/whats-new) is built from this list.
//
// To announce an update: add a release at the TOP of RELEASES with today's date, a short title,
// and one item per change, tagged with who it's for. Keep it in plain language, focused on what
// people can now do. No em dashes (house style).

export const AUDIENCES = ["speakers", "organizers", "sponsors", "everyone"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  speakers: "Speakers",
  organizers: "Organizers",
  sponsors: "Sponsors",
  everyone: "Account and privacy",
};

export type ReleaseItem = {
  audience: Audience;
  title: string;
  body: string;
  /** Where to try it. Signed-in pages go through sign-in automatically. */
  href?: string;
  /**
   * Screenshot id: public/whats-new/<shot>.jpg, made by scripts/demo/shoot.mjs from the entry in
   * scripts/demo/whats-new-shots.json. Required for every item (see scripts/whats-new-check.mjs).
   */
  shot: string;
};

export type Release = {
  /** ISO date (YYYY-MM-DD); also the anchor id on the page. */
  date: string;
  title: string;
  summary?: string;
  items: ReleaseItem[];
};

export const RELEASES: Release[] = [
  {
    date: "2026-11-21",
    title: "Schedules, calendar files and decision emails",
    summary: "Build a timetable with rooms and time slots, tell every speaker the outcome by email, and put sessions straight into anyone's calendar.",
    items: [
      { audience: "organizers", title: "Schedule builder", shot: "schedule-builder", body: "A new Schedule tab with a column per room and a tab per day. Drag accepted sessions onto the grid (or pick a day, time and room on your phone), add breaks and plenary items, and get a warning when a room or a speaker is double-booked." },
      { audience: "organizers", title: "Publish the schedule", shot: "publish-schedule", body: "Publishing puts the timetable on your event page and emails every scheduled speaker their time slot. Move a session later and you can send just the changed slots." },
      { audience: "organizers", title: "Decision emails", shot: "decision-emails", body: "Publishing decisions now emails each speaker: accepted, waitlisted or not selected. Edit the three emails per event in Settings, with placeholders and a live preview, or switch them off." },
      { audience: "organizers", title: "Speaker confirmation", shot: "speaker-confirmation", body: "Accepted speakers confirm they'll be there, or tell you they can't make it. The Programme tab shows who has confirmed, and you get an email either way. Declined sessions leave the programme and schedule automatically." },
      { audience: "speakers", title: "Confirm your accepted sessions", shot: "confirm-accepted-sessions", href: "/submissions", body: "When a talk is accepted you get an email and a reminder on your dashboard. Confirm with one click, or let the organizers know you can't make it, with an optional note." },
      { audience: "speakers", title: "Your time slot, in your calendar", shot: "time-slot-calendar", href: "/export", body: "Once the schedule is published you get your time and room by email, with a calendar file. Your export page also has a speaking calendar with every accepted talk." },
      { audience: "everyone", title: "Add events and sessions to your calendar", shot: "add-to-calendar", href: "/events", body: "Every event page has an \"Add to your calendar\" button, and with a published schedule each session has its own calendar link. Works with Outlook, Google and Apple Calendar." },
    ],
  },
  {
    date: "2026-11-21",
    title: "SpeakerDesk is live",
    summary: "Everything that is in place today for speakers, organizers and sponsors. From here on, every update gets its own entry on this page.",
    items: [
      // ─── Speakers ──────────────────────────────────────────────────────────
      { audience: "speakers", title: "One speaker profile", shot: "speaker-profile", href: "/profile", body: "Short, medium and long bios, a hosted headshot, tagline, location and links, all in one place and ready for any call for papers." },
      { audience: "speakers", title: "Session library", shot: "session-library", href: "/sessions", body: "Keep every talk with its title, pitch, short and long abstract, key takeaways, format, level and duration. Write it once and reuse it everywhere." },
      { audience: "speakers", title: "Paste-ready copy for other platforms", shot: "copy-ready-text", body: "Copy your bio and abstracts in the right length for Sessionize, run.events, Pretalx and PaperCall, with a warning when text goes over the usual character limit." },
      { audience: "speakers", title: "Submission tracker", shot: "submission-tracker", href: "/submissions", body: "Track every CfP you submit to, on SpeakerDesk or elsewhere: deadlines, status from draft to accepted, and the decision when it arrives." },
      { audience: "speakers", title: "Submit to open calls in a few clicks", shot: "submit-open-call", href: "/events", body: "Browse open calls for papers and submit straight from your session library. You get a confirmation email for every proposal." },
      { audience: "speakers", title: "Import your history", shot: "import-history", href: "/import", body: "Bring in sessions and past talks from your public Sessionize or run.events profile, a Pretalx event or a CSV file. Imports never overwrite what you already have." },
      { audience: "speakers", title: "Export your data", shot: "export-data", href: "/export", body: "Download a full JSON backup, a speaker kit in Markdown, a CSV of your sessions, or an MVP activities sheet laid out like the Microsoft MVP portal's speaking form." },
      { audience: "speakers", title: "Delivery details for MVP reporting", shot: "mvp-delivery-details", body: "Record the technology area, audience, attendee numbers and stream or on-demand views on each accepted talk, so your MVP activities export is complete." },
      { audience: "speakers", title: "Public speaker page", shot: "public-speaker-page", href: "/speakers", body: "Opt in to a public page with your bio, published talks and badges, listed in the speaker directory so organizers can find and invite you." },
      { audience: "speakers", title: "Speaking invitations", shot: "speaking-invitations", href: "/invitations", body: "Organizers can invite you to speak at their event. Accept or decline from your invitations page." },
      { audience: "speakers", title: "Badges and credentials", shot: "badges-credentials", href: "/badges", body: "Events can award you badges, such as Speaker, Keynote speaker or Top-rated session. Accept the ones you want, show them on your profile and share each one as a verifiable credential page." },
      { audience: "speakers", title: "Session requirements", shot: "session-requirements", body: "Tell organizers what you need on stage, from a confidence monitor to a lapel microphone, as part of your proposal." },

      // ─── Organizers ────────────────────────────────────────────────────────
      { audience: "organizers", title: "Publish a call for papers", shot: "publish-call-for-papers", href: "/organize/new", body: "Create your event with tracks, session formats, character limits, a proposal limit per speaker and a closing date. Mark it in person, online or hybrid, add a cover image and a venue on the map." },
      { audience: "organizers", title: "Public event page", shot: "public-event-page", body: "Every published event gets its own page with the CfP, programme and sponsors, share buttons and search engine friendly event details, so it shows up in search results." },
      { audience: "organizers", title: "Complete proposals", shot: "complete-proposals", body: "Proposals arrive as a snapshot with bio, headshot, abstract, takeaways and the speaker's stage requirements. No more chasing missing details." },
      { audience: "organizers", title: "Review with your team", shot: "review-with-team", body: "Score proposals with your review committee, with blind review if you like, so reviewers see the content without the speaker's name." },
      { audience: "organizers", title: "Decisions and programme", shot: "decisions-and-programme", body: "Accept, waitlist or reject, publish the decisions when you're ready, and publish the programme on your event page." },
      { audience: "organizers", title: "Invite speakers directly", shot: "invite-speakers", body: "Invite a speaker from the directory or by email straight from your programme, for keynotes and invited talks." },
      { audience: "organizers", title: "Event team and roles", shot: "event-team-roles", body: "Add co-organizers, reviewers and volunteers. Each role sees only what it needs, and the People page shows everyone across all your events." },
      { audience: "organizers", title: "Event runbook", shot: "event-runbook", body: "Start from a standard conference runbook with tasks planned back from your event date. Assign owners, track status, and let SpeakerDesk tick off tasks it can check by itself, like a published CfP or a reached budget target." },
      { audience: "organizers", title: "Sponsor packages and budget", shot: "sponsor-packages-budget", body: "Publish a sponsor prospectus with packages and add-ons, approve requests, follow each deal from confirmed to invoiced to paid, and watch secured income against your budget target." },
      { audience: "organizers", title: "Sponsor deliverables", shot: "sponsor-deliverables", body: "Track logos, booth needs and every other deliverable per sponsor until the doors open." },
      { audience: "organizers", title: "Badges for your speakers and team", shot: "badges-for-team", body: "Award ready-made or custom badges to accepted speakers and your team. They accept them and can share them as credentials." },

      // ─── Sponsors ──────────────────────────────────────────────────────────
      { audience: "sponsors", title: "Find events to sponsor", shot: "find-events-to-sponsor", href: "/sponsor", body: "Browse events with a published sponsor prospectus and compare their packages side by side." },
      { audience: "sponsors", title: "Request a package in one go", shot: "request-package", body: "Pick a package, add extras like the coffee bar or the after-party, and request booth power, lead scanning and other needs in the same request." },
      { audience: "sponsors", title: "Company profile", shot: "sponsor-company-profile", href: "/sponsor/company", body: "Keep your company name, website, logo, description and contact person in one place, reused for every event you sponsor." },
      { audience: "sponsors", title: "Track every sponsorship", shot: "track-sponsorships", href: "/sponsor/deals", body: "See each deal's status from requested to confirmed, invoiced and paid, with a checklist of deliverables for every event." },

      // ─── Everyone ──────────────────────────────────────────────────────────
      { audience: "everyone", title: "One account, three roles", shot: "one-account-three-roles", body: "Switch between speaker, organizer and sponsor views at any time. Each view has its own menu." },
      { audience: "everyone", title: "Sign in your way", shot: "sign-in-options", href: "/sign-in", body: "Use a one-time code, a password, or your GitHub, Google, LinkedIn or Microsoft account. New accounts confirm their email with a code, and repeated failed sign-ins are slowed down." },
      { audience: "everyone", title: "Privacy by design", shot: "privacy-by-design", href: "/privacy", body: "We only ask for what an event needs. You can export your data at any time and delete your account yourself, and important account activity is logged for 90 days." },
      { audience: "everyone", title: "Works on your phone", shot: "works-on-phone", body: "Every page, including the runbook and proposal review, works on a small screen, with light and dark themes." },
    ],
  },
];

export const latestRelease = () => RELEASES[0];
