-- Demo content for screenshots and manual testing. Run by scripts/demo/seed.mjs against a LOCAL
-- database only. {{U:email}} is replaced with the user's id. Every id starts with "seed_".

-- Sign-up creates an empty speaker profile; the demo one replaces it.
DELETE FROM speaker_profile WHERE "userId" IN (SELECT id FROM "user" WHERE email LIKE 'demo-%@example.com');

-- ── Accounts: ready to use (verified, onboarded, terms accepted) ───────────────
UPDATE "user" SET "emailVerified" = true, "onboardedAt" = now(), "termsAcceptedAt" = now(), "termsVersion" = '2026-11-21',
  "primaryRole" = CASE email
    WHEN 'demo-organizer@example.com' THEN 'ORGANIZER'
    WHEN 'demo-sponsor@example.com' THEN 'SPONSOR'
    ELSE 'SPEAKER' END::"AccountRole"
WHERE email LIKE 'demo-%@example.com';

-- ── Speaker profiles (public) ───────────────────────────────────────────────────
INSERT INTO speaker_profile (id, "userId", "fullName", tagline, company, "jobTitle", "bioShort", "bioMedium", "bioLong", city, country,
  "websiteUrl", "linkedinUrl", "publicProfile", slug, "openToInvites", topics, "updatedAt") VALUES
('seed_prof_alex', {{U:demo-speaker@example.com}}, 'Alex Rivera', 'Cloud architect and Kubernetes speaker', 'Contoso Cloud', 'Principal Engineer',
  'Alex designs platforms that small teams can run. Speaks about Kubernetes, GitOps and calm on-call rotations.',
  'Alex has spent ten years building cloud platforms for scale-ups and public-sector teams. Talks are practical: what broke, what they changed, and what they would do again.',
  'Alex has spoken at European cloud and DevOps conferences since 2019. The focus is always on operations: GitOps, edge clusters, observability that people actually read, and platform teams that do not burn out.',
  'Amsterdam', 'NL', 'https://example.com/alex', 'https://example.com/in/alex', true, 'alex-rivera', true, ARRAY['Kubernetes','Platform engineering','GitOps'], now()),
('seed_prof_priya', {{U:demo-speaker-2@example.com}}, 'Priya Nair', 'Security engineer, AI systems', 'Fabrikam Labs', 'Staff Security Engineer',
  'Priya helps teams threat-model AI systems before they ship. Hands-on, with real attack paths.',
  'Priya leads security reviews for machine learning products and writes the threat models that engineers actually use.',
  'Priya works on the boundary between security and machine learning: prompt injection, data poisoning, and the controls that hold up in production.',
  'London', 'GB', '', '', true, 'priya-nair', true, ARRAY['AI security','Threat modelling'], now()),
('seed_prof_sam', {{U:demo-speaker-3@example.com}}, 'Sam Okafor', 'Zero trust for small teams', 'Litware', 'Head of Infrastructure',
  'Sam makes zero trust practical for teams of five to fifty people.',
  'Sam runs infrastructure for a 40-person company and talks about the unglamorous parts of identity, devices and access reviews.',
  'Sam writes and speaks about zero trust without the vendor bingo: which controls matter first, and how to roll them out without locking the team out.',
  'Berlin', 'DE', '', '', true, 'sam-okafor', true, ARRAY['Security','Identity'], now()),
('seed_prof_lena', {{U:demo-speaker-4@example.com}}, 'Lena Berg', 'Data engineer and speaker', 'Tailspin Data', 'Data Platform Lead',
  'Lena builds data platforms and talks about vector search and migrations.',
  'Lena leads a data platform team and has migrated three legacy warehouses. She likes talks with numbers in them.',
  'Lena speaks about search, retrieval and the messy reality of moving data platforms without stopping the business.',
  'Stockholm', 'SE', '', '', true, 'lena-berg', true, ARRAY['Data','Search'], now());

-- ── Session library: Alex's talks ───────────────────────────────────────────────
INSERT INTO talk (id, "userId", title, subtitle, "abstractShort", "abstractLong", takeaways, format, "durationMinutes", level, "primaryTrack", tags, "updatedAt", published) VALUES
('seed_talk_edge', {{U:demo-speaker@example.com}}, 'Operating Kubernetes at the edge', 'Lessons from 200 small clusters',
  'Running two hundred small clusters in shops and depots taught us what breaks first: networking, updates and on-call.',
  'We run around two hundred Kubernetes clusters on small hardware in shops and depots. This talk covers the failures we saw in the first year, the GitOps setup that made updates boring, and the monitoring that let one engineer look after the fleet.',
  ARRAY['Design for disconnected operation','Make updates boring with GitOps','Alert on what customers feel'], 'SESSION', 45, 'ADVANCED', 'Cloud', ARRAY['kubernetes','edge','gitops'], now(), true),
('seed_talk_obs', {{U:demo-speaker@example.com}}, 'Observability nobody ignores', '',
  'Dashboards are where good alerts go to die. How to build observability people read.',
  'A practical approach to observability: a small number of service-level objectives, alerts that point to a runbook, and dashboards that answer one question each.',
  ARRAY['Start from user-visible objectives','One dashboard, one question'], 'SESSION', 30, 'INTERMEDIATE', 'Cloud', ARRAY['observability'], now(), true),
('seed_talk_gitops', {{U:demo-speaker@example.com}}, 'GitOps for teams of five', '',
  'You do not need a platform team to get GitOps. Here is the smallest setup that works.',
  'The smallest GitOps setup that works for a small team, what to automate first and what to leave manual.',
  ARRAY['Start with one repository','Automate the boring releases first'], 'WORKSHOP', 90, 'BEGINNER', 'Cloud', ARRAY['gitops'], now(), false);

-- ── Event: Cloud Summit Demo (open CfP, published programme and schedule) ────────
INSERT INTO event (id, slug, name, tagline, description, format, location, venue, address, latitude, longitude, website,
  "startDate", "endDate", "cfpPublished", "programPublished", "schedulePublished", "cfpOpensAt", "cfpClosesAt", "cfpGuidelines",
  tracks, formats, "titleLimit", "abstractLimit", "maxProposalsPerSpeaker", "blindReview", "sponsorshipOpen", "prospectusIntro",
  "budgetTarget", "otherIncome", currency, timezone, "updatedAt") VALUES
('seed_evt_cloud', 'cloud-summit-demo', 'Cloud Summit Demo', 'Two days on running the cloud well',
  'A two-day conference for platform engineers, operators and the people who keep production calm. Talks are practical, and every session has a speaker who has run the thing in production.',
  'IN_PERSON', 'Amsterdam, NL', 'Example Hall', 'Europaplein 1, Amsterdam', 52.3555, 4.8728, 'https://example.com/cloud-summit',
  '2027-05-10', '2027-05-11', true, true, true, '2026-09-01', '2027-03-31',
  'We want talks from people who have run systems in production. Tell us what broke, what you changed and what you would do again.',
  ARRAY['Cloud','AI','Security'], ARRAY['SESSION','WORKSHOP','LIGHTNING_TALK','KEYNOTE']::"TalkFormat"[], 80, 2000, 3, false, true,
  'Two days, around 600 platform engineers. Packages below, or ask for something custom.',
  60000, 10000, 'EUR', 'Europe/Amsterdam', now());

INSERT INTO event_member (id, "eventId", "userId", role, title) VALUES
('seed_mem_owner', 'seed_evt_cloud', {{U:demo-organizer@example.com}}, 'OWNER', 'Conference lead'),
('seed_mem_reviewer', 'seed_evt_cloud', {{U:demo-reviewer@example.com}}, 'REVIEWER', 'Review committee');

INSERT INTO schedule_room (id, "eventId", name, capacity, position) VALUES
('seed_room_main', 'seed_evt_cloud', 'Main stage', 400, 0),
('seed_room_work', 'seed_evt_cloud', 'Workshop room', 60, 1);

-- ── Proposals (speaker side is a snapshot of the talk) ──────────────────────────
INSERT INTO proposal (id, "eventId", "speakerId", "talkId", title, abstract, takeaways, format, "durationMinutes", level, track,
  "decision", "decisionPublished", "decidedAt", confirmation, "slotDay", "slotStart", "roomId", invited, "updatedAt") VALUES
('seed_prop_edge', 'seed_evt_cloud', {{U:demo-speaker@example.com}}, 'seed_talk_edge', 'Operating Kubernetes at the edge',
  'Two hundred small clusters taught us what breaks first.', ARRAY['Design for disconnected operation','Make updates boring with GitOps'],
  'SESSION', 45, 'ADVANCED', 'Cloud', 'ACCEPTED', true, now(), 'CONFIRMED', '2027-05-10', 555, 'seed_room_main', false, now()),
('seed_prop_platform', 'seed_evt_cloud', {{U:demo-speaker@example.com}}, NULL, 'Platform engineering for teams of five',
  'The smallest platform setup that works.', ARRAY['Start small'], 'SESSION', 30, 'INTERMEDIATE', 'Cloud',
  'ACCEPTED', true, now(), 'PENDING', NULL, NULL, NULL, false, now()),
('seed_prop_ai', 'seed_evt_cloud', {{U:demo-speaker-2@example.com}}, NULL, 'Threat modelling for AI systems',
  'A hands-on workshop: map the attack paths of an AI product, then pick the controls that matter.', ARRAY['Map the attack paths','Pick controls that hold in production'],
  'WORKSHOP', 90, 'INTERMEDIATE', 'Security', 'ACCEPTED', true, now(), 'CONFIRMED', '2027-05-10', 780, 'seed_room_work', false, now()),
('seed_prop_zero', 'seed_evt_cloud', {{U:demo-speaker-3@example.com}}, NULL, 'Zero trust for small teams',
  'Which controls matter first, and how to roll them out without locking the team out.', ARRAY['Start with identity','Review access every quarter'],
  'SESSION', 30, 'BEGINNER', 'Security', 'ACCEPTED', true, now(), 'PENDING', NULL, NULL, NULL, false, now()),
('seed_prop_search', 'seed_evt_cloud', {{U:demo-speaker-4@example.com}}, NULL, 'Vector search without the hype',
  'What vector search is good at, and what it is not.', ARRAY['Measure before you migrate'], 'LIGHTNING_TALK', 15, 'BEGINNER', 'AI',
  'WAITLISTED', true, now(), NULL, NULL, NULL, NULL, false, now()),
('seed_prop_legacy', 'seed_evt_cloud', {{U:demo-speaker-4@example.com}}, NULL, 'Legacy warehouse migration, war stories',
  'Three migrations, what went wrong and what we would do differently.', ARRAY['Keep both systems running'], 'SESSION', 45, 'INTERMEDIATE', 'Cloud',
  'REJECTED', true, now(), NULL, NULL, NULL, NULL, false, now()),
('seed_prop_rag', 'seed_evt_cloud', {{U:demo-speaker-4@example.com}}, NULL, 'Retrieval for internal knowledge bases',
  'How we answer staff questions from 40,000 pages without making things up.', ARRAY['Evaluate with real questions'], 'SESSION', 30, 'ADVANCED', 'AI',
  'UNDECIDED', false, NULL, NULL, NULL, NULL, NULL, false, now());

-- Reviews from the committee (scores drive the averages on the proposal list)
INSERT INTO review (id, "proposalId", "reviewerId", score, comment, "updatedAt") VALUES
('seed_rev_1', 'seed_prop_edge', {{U:demo-reviewer@example.com}}, 5, 'Real operations, real numbers.', now()),
('seed_rev_2', 'seed_prop_ai', {{U:demo-reviewer@example.com}}, 4, 'Hands-on and timely.', now()),
('seed_rev_3', 'seed_prop_zero', {{U:demo-reviewer@example.com}}, 4, 'Practical. Needs a tighter abstract.', now()),
('seed_rev_4', 'seed_prop_search', {{U:demo-reviewer@example.com}}, 3, 'Good topic, crowded field.', now()),
('seed_rev_5', 'seed_prop_legacy', {{U:demo-reviewer@example.com}}, 2, 'Covered elsewhere this year.', now()),
('seed_rev_6', 'seed_prop_rag', {{U:demo-reviewer@example.com}}, 4, '', now());

-- Invited speaker (accepted an invitation, so confirmed from the start)
INSERT INTO speaker_invitation (id, "eventId", "speakerId", "talkId", "invitedById", message, status, "responseNote", "respondedAt") VALUES
('seed_inv_sam', 'seed_evt_cloud', {{U:demo-speaker-3@example.com}}, NULL, {{U:demo-organizer@example.com}},
  'We would love a security session on the main stage. Pick any topic you like.', 'PENDING', '', NULL);

-- ── Schedule items ─────────────────────────────────────────────────────────────
INSERT INTO schedule_item (id, "eventId", day, "startMinute", "endMinute", title, "roomId") VALUES
('seed_item_reg', 'seed_evt_cloud', '2027-05-10', 480, 540, 'Registration and coffee', NULL),
('seed_item_lunch', 'seed_evt_cloud', '2027-05-10', 750, 810, 'Lunch', NULL),
('seed_item_break', 'seed_evt_cloud', '2027-05-10', 630, 645, 'Coffee break', NULL);

-- ── Runbook (a few tasks with live status) ─────────────────────────────────────
INSERT INTO runbook_task (id, "eventId", title, category, "dueDate", status, priority, "assigneeId", "autoCheck", "updatedAt", "sortOrder") VALUES
('seed_task_venue', 'seed_evt_cloud', 'Book the venue', 'Venue', '2026-09-15', 'DONE', 'HIGH', NULL, 'venue_set', now(), 1),
('seed_task_cfp', 'seed_evt_cloud', 'Publish the call for papers', 'Speakers', '2026-09-01', 'DONE', 'HIGH', NULL, 'cfp_published', now(), 2),
('seed_task_review', 'seed_evt_cloud', 'Score every proposal', 'Speakers', '2027-02-15', 'IN_PROGRESS', 'NORMAL', {{U:demo-reviewer@example.com}}, 'proposals_reviewed', now(), 3),
('seed_task_sponsors', 'seed_evt_cloud', 'Publish the sponsor prospectus', 'Sponsors', '2026-12-01', 'DONE', 'HIGH', NULL, 'prospectus_published', now(), 4),
('seed_task_tickets', 'seed_evt_cloud', 'Launch the website and ticket sales', 'Marketing', '2026-12-15', 'TODO', 'NORMAL', NULL, NULL, now(), 5),
('seed_task_av', 'seed_evt_cloud', 'Confirm AV requirements with speakers', 'Production', '2027-04-15', 'TODO', 'HIGH', NULL, NULL, now(), 6);

-- ── Sponsors ───────────────────────────────────────────────────────────────────
INSERT INTO sponsor_org (id, "ownerId", name, website, description, "contactName", "contactEmail", "updatedAt") VALUES
('seed_org_north', {{U:demo-sponsor@example.com}}, 'Northwind Cloud', 'https://example.com/northwind',
  'Managed Kubernetes and developer tooling for European platform teams.', 'Chris Lindqvist', 'demo-sponsor@example.com', now());

INSERT INTO sponsor_package (id, "eventId", kind, name, tagline, price, quantity, benefits, deliverables, featured, published, "sortOrder", "updatedAt") VALUES
('seed_pkg_plat', 'seed_evt_cloud', 'TIER', 'Platinum', 'Headline partner', 12000, 2, ARRAY['Keynote slot','Logo on stage and website','Two conference passes'], ARRAY['Logo file','Booth staff names'], true, true, 1, now()),
('seed_pkg_gold', 'seed_evt_cloud', 'TIER', 'Gold', 'Main partner', 7000, 4, ARRAY['Booth in the expo hall','Logo on website','Two conference passes'], ARRAY['Logo file','Booth staff names'], false, true, 2, now()),
('seed_pkg_comm', 'seed_evt_cloud', 'TIER', 'Community', 'Support the community', 2500, NULL, ARRAY['Logo on website','One conference pass'], ARRAY['Logo file'], false, true, 3, now()),
('seed_pkg_coffee', 'seed_evt_cloud', 'ADDON', 'Coffee bar', 'Your name on every cup', 1500, 2, ARRAY['Branded coffee bar for one morning'], ARRAY['Branded cups delivered'], false, true, 4, now()),
('seed_pkg_lanyard', 'seed_evt_cloud', 'ADDON', 'Lanyards', 'Worn by every attendee', 800, 1, ARRAY['Logo on every lanyard'], ARRAY['Lanyard artwork'], false, true, 5, now());

INSERT INTO sponsorship (id, "eventId", "sponsorOrgId", status, requirements, message, "completedDeliverables", "decidedAt", "updatedAt") VALUES
('seed_deal_gold', 'seed_evt_cloud', 'seed_org_north', 'APPROVED', ARRAY['booth_power','lead_scanner'], 'We would like the Gold package with a booth in the expo hall.', ARRAY['Logo file'], now(), now()),
('seed_deal_coffee', 'seed_evt_cloud', 'seed_org_north', 'APPLIED', ARRAY[]::text[], 'Could we add the coffee bar as well?', ARRAY[]::text[], NULL, now());
INSERT INTO sponsorship_item (id, "sponsorshipId", "packageId", kind, name, price, deliverables) VALUES
('seed_item_gold', 'seed_deal_gold', 'seed_pkg_gold', 'TIER', 'Gold', 7000, ARRAY['Logo file','Booth staff names']),
('seed_item_coffee', 'seed_deal_coffee', 'seed_pkg_coffee', 'ADDON', 'Coffee bar', 1500, ARRAY['Branded cups delivered']);

-- ── Speaker side: submissions tracker and badges ────────────────────────────────
INSERT INTO submission (id, "userId", "talkId", "eventName", "eventUrl", "cfpUrl", platform, location, status, "cfpDeadline", "eventStart", "eventEnd", "submittedAt", "decisionAt", "updatedAt", "externalId") VALUES
('seed_sub_edge', {{U:demo-speaker@example.com}}, 'seed_talk_edge', 'Cloud Summit Demo', 'https://example.com/cloud-summit', 'https://example.com/cloud-summit', 'SPEAKERDESK', 'Amsterdam, NL', 'ACCEPTED', '2027-03-31', '2027-05-10', '2027-05-11', now(), now(), now(), 'speakerdesk:seed_evt_cloud'),
('seed_sub_platform', {{U:demo-speaker@example.com}}, NULL, 'Cloud Summit Demo', 'https://example.com/cloud-summit', 'https://example.com/cloud-summit', 'SPEAKERDESK', 'Amsterdam, NL', 'ACCEPTED', '2027-03-31', '2027-05-10', '2027-05-11', now(), now(), now(), 'speakerdesk:seed_evt_cloud'),
('seed_sub_kube', {{U:demo-speaker@example.com}}, 'seed_talk_edge', 'EdgeConf Berlin', 'https://example.com/edgeconf', 'https://example.com/edgeconf/cfp', 'SESSIONIZE', 'Berlin, DE', 'SUBMITTED', '2026-12-10', '2027-02-20', '2027-02-21', now(), NULL, now(), NULL),
('seed_sub_gitops', {{U:demo-speaker@example.com}}, 'seed_talk_gitops', 'DevOps Days Utrecht', 'https://example.com/devopsdays', 'https://example.com/devopsdays/cfp', 'PRETALX', 'Utrecht, NL', 'ACCEPTED', '2026-08-01', '2026-06-04', '2026-06-05', now(), now(), now(), NULL);

-- Badges: platform badges awarded to speakers (one accepted, one waiting for a reply)
INSERT INTO badge_award (id, "badgeId", "eventId", "recipientId", "awardedById", message, status, "showOnProfile", "respondedAt", "createdAt") VALUES
('seed_award_speaker', (SELECT id FROM badge WHERE key = 'speaker'), 'seed_evt_cloud', {{U:demo-speaker@example.com}}, {{U:demo-organizer@example.com}},
  'Thanks for making the edge session a highlight.', 'ACCEPTED', true, now(), now()),
('seed_award_keynote', (SELECT id FROM badge WHERE key = 'keynote'), 'seed_evt_cloud', {{U:demo-speaker@example.com}}, {{U:demo-organizer@example.com}},
  'We would love you on the main stage next year.', 'PENDING', true, NULL, now()),
('seed_award_workshop', (SELECT id FROM badge WHERE key = 'workshop'), 'seed_evt_cloud', {{U:demo-speaker-2@example.com}}, {{U:demo-organizer@example.com}},
  'Hands-on and useful. Thank you.', 'ACCEPTED', true, now(), now());

-- Link Alex's two SpeakerDesk proposals to their tracker entries (the confirmation card needs it).
UPDATE proposal SET "submissionId" = 'seed_sub_edge' WHERE id = 'seed_prop_edge';
UPDATE proposal SET "submissionId" = 'seed_sub_platform' WHERE id = 'seed_prop_platform';

-- ── Tickets: registration open, three ticket types and a few attendees ─────────
UPDATE event SET "registrationOpen" = true, "registrationCapacity" = 600, "sponsorSharingEnabled" = true,
  "registrationNote" = 'Free for everyone. Please cancel your ticket if you can''t come, so someone else can.'
WHERE id = 'seed_evt_cloud';

INSERT INTO ticket_type (id, "eventId", name, description, capacity, "priceLabel", published, position, "updatedAt") VALUES
('seed_tt_pass', 'seed_evt_cloud', 'Two-day pass', 'Both conference days, lunch included', 500, 'Free', true, 0, now()),
('seed_tt_work', 'seed_evt_cloud', 'Workshop day', 'Hands-on workshops on day two', 60, 'Free', true, 1, now()),
('seed_tt_speaker', 'seed_evt_cloud', 'Speaker', 'For speakers and crew', NULL, '', false, 2, now());

INSERT INTO registration (id, "eventId", "ticketTypeId", code, name, email, company, "jobTitle", status, source, "sourcePlatform", "shareWithSponsors", "consentAt", "ticketSentAt", "checkedInAt", "updatedAt") VALUES
('seed_reg_1', 'seed_evt_cloud', 'seed_tt_pass', 'seedTicketDemoCode0001', 'Noor Jansen', 'noor.demo@example.com', 'Contoso Retail', 'Platform Engineer', 'ACTIVE', 'SPEAKERDESK', '', true, now(), now(), now() - interval '20 minutes', now()),
('seed_reg_2', 'seed_evt_cloud', 'seed_tt_pass', 'seedTicketDemoCode0002', 'Tom Becker', 'tom.demo@example.com', 'Fabrikam', 'SRE Lead', 'ACTIVE', 'SPEAKERDESK', '', true, now(), now(), NULL, now()),
('seed_reg_3', 'seed_evt_cloud', 'seed_tt_work', 'seedTicketDemoCode0003', 'Ines Moreau', 'ines.demo@example.com', 'Litware', 'Security Architect', 'ACTIVE', 'SPEAKERDESK', '', false, NULL, now(), NULL, now()),
('seed_reg_4', 'seed_evt_cloud', 'seed_tt_pass', 'seedTicketDemoCode0004', 'Daan Visser', 'daan.demo@example.com', 'Northwind', 'Developer', 'ACTIVE', 'IMPORT', 'meetup', false, NULL, NULL, NULL, now()),
('seed_reg_5', 'seed_evt_cloud', 'seed_tt_pass', 'seedTicketDemoCode0005', 'Mei Chen', '', '', '', 'ACTIVE', 'IMPORT', 'meetup', false, NULL, NULL, NULL, now()),
('seed_reg_6', 'seed_evt_cloud', 'seed_tt_pass', 'seedTicketDemoCode0006', 'Lars Holm', 'lars.demo@example.com', 'Tailspin', 'CTO', 'CANCELLED', 'SPEAKERDESK', '', true, now(), now(), NULL, now()),
('seed_reg_7', 'seed_evt_cloud', 'seed_tt_speaker', 'seedTicketDemoCode0007', 'Alex Rivera', 'demo-speaker@example.com', 'Contoso Cloud', 'Principal Engineer', 'ACTIVE', 'MANUAL', '', false, NULL, now(), NULL, now());
