# SpeakerDesk

A solution to maintain all your talks, submissions, status etc.

SpeakerDesk is a two-sided portal for conference speakers and event organizers.

- **Speakers** keep one canonical profile and one library of sessions, track every call for papers (CfP), and paste the right text into Sessionize, run.events, Pretalx or PaperCall without re-typing it.
- **Organizers** publish a CfP on SpeakerDesk, receive proposals straight from speakers' libraries, review them with their team, and publish decisions and a programme.

## Features (MVP)

| Area | What's there |
| --- | --- |
| **Speaker profile** | Name, tagline, pronouns, short/medium/long bios with live character counters, square + landscape headshots (uploaded to Blob Storage, permanent URLs), location/timezone, social links, travel & logistics |
| **Sessions** | Title, subtitle, short pitch + master abstract, outline, 3–5 key takeaways, format, duration, level (100–400), track, tags, language, slides/recording links, equipment needs, organizer notes. Search, tag filter, archive, duplicate |
| **Copy for a CfP** | Per-platform presets (Sessionize, run.events, Pretalx, PaperCall) with 1-click copy and over-limit warnings; it automatically suggests the short pitch when the master abstract is too long |
| **Submission tracker** | Event, platform, CfP link and deadline, event dates, status (Draft → Submitted → Accepted/Waitlisted/Rejected/Withdrawn) with inline status changes, and recording links for delivery history |
| **Dashboard** | Active sessions, pending decisions, acceptance rate, upcoming deadlines and talks, profile completeness |
| **Import** | Sessionize public API endpoint, Pretalx REST API (pretalx.com or self-hosted), CSV (run.events / spreadsheets), SpeakerDesk JSON backup. Imports are idempotent and never overwrite existing data |
| **Export** | Full JSON backup, Markdown speaker kit, CSV of sessions, and Markdown for each session |
| **Open calls** (public) | `/events` lists every published CfP that hasn't closed. Each event page (`/events/{slug}`) shows the CfP rules and, once published, the programme |
| **Submitting to a CfP** | Speakers start from a session in their library and tailor it for the event. Title and abstract limits, allowed formats, tracks and the per-speaker cap are enforced on the server. Each proposal appears automatically in the speaker's tracker, and speakers can withdraw it until a decision is published |
| **Passcode sign-in** | "Email me a sign-in code instead" signs you in with a 6-digit code (no password needed, and it creates the account for new emails). "Forgot password?" resets by code. Codes expire after 10 minutes and allow 5 attempts |
| **Guided onboarding** (`/onboarding`) | New accounts land on a checklist. **Required:** personal details (name, country, timezone, what brings you here, terms) and a verified email, plus role-specific tasks: a photo and bio and a first session for speakers, a first event for organizers, a company profile for sponsors. **Optional:** publishing a speaker page, inviting a team, adding a password. A banner nudges until setup is finished |
| **Account settings** (`/account`) | Verify your email; change it (with a code sent to the new address); change or set your password; see your sign-in methods and active devices, and sign out other devices |
| **Platform admin** (`/admin`) | For users with the admin role (bootstrap with `ADMIN_EMAILS`). **Overview** of users, events, proposals, sponsorship and email health. **Users:** search and filter, then per user email a reset code, set a temporary password, mark the email verified or unverified, change the email, ban or unban, grant or revoke admin, sign out everywhere, restart onboarding, "View as" (impersonation with a visible support banner), and delete the account (blocked while they're an event's only owner). **Events:** moderation (unpublish CfP, close sponsorship), join as owner for support, delete. **Email outbox** and an **audit log** of every admin action |
| **One sign-in for everyone** | A single **Sign in** page for speakers, organizers and sponsors. Where you land is decided by `/api/account/continue`: a link with a destination (e.g. "Run a call for papers" → `/sign-in?next=/organize/new`) goes there and switches the view to match; returning users go to their usual home; new accounts pick what they came for on `/welcome`. One account can switch views from the sidebar |
| **Venue search** | The event form searches venues and addresses as you type. It uses Azure Maps when `AZURE_MAPS_KEY` is set and falls back to the free OpenStreetMap Photon service in development. Picking a result fills venue, address, city/country and coordinates, and the event page shows an OpenStreetMap embed |
| **Presentation requirements** | Speakers tick what they need when submitting (projector, mics, clicker, wired internet, workshop power, step-free access, captioning, no recording…) plus a free-text note. Organizers see it on each proposal and as an aggregated **production checklist** for accepted sessions |
| **Sponsors** (`/sponsor`) | Sponsors keep a company profile, browse events with an open prospectus, choose one tier plus any add-ons (with live totals and sold-out handling), list their on-site needs (booth size, power, lead scanning, staff passes…), and work through a deliverables checklist. The deal moves through Requested → Confirmed → Invoiced → Paid |
| **Sponsor packages & budget** (organizer) | Organizers create tiers and add-ons with price, quantity, benefits and deliverables, then publish the prospectus. A budget tracker shows other income, paid, confirmed and requested amounts against the target. Confirmed sponsors appear on the public event page, grouped by tier |
| **Event teams** (Team tab, `/organize/people`) | Four roles: **Owner**, **Co-organizer**, **Reviewer** and **Volunteer**, shown in a permission matrix on the Team tab. You can invite several people by email at once. Existing accounts join immediately; for new addresses you get an invite link that only works for that email and expires after 14 days, and the invite is also claimed automatically when that person signs up. The team dashboard shows each member's role, title, open/overdue tasks, reviews and last activity. `/organize/people` lists everyone across all events you run |
| **Runbook** (Runbook tab) | Tasks with due date, owner, category, priority and status. You can apply a standard 24-step conference runbook timed to the event date; tasks that are already late get a catch-up date. Ten tasks **tick themselves off** from platform state (CfP published, budget reached, decisions published…). The health score is On track, At risk or Off track, with an expected-progress marker, an overdue / this-week view, progress by area and workload per person. "My tasks" shows your assigned tasks across all events. Volunteers and reviewers can update only their own tasks |
| **Speaker directory** (`/speakers`) | Speakers opt in to a public page (choosing its address, topics and availability) and publish individual talks. Only public fields are shown — never email, travel or logistics. The directory is searchable by name, topic or talk |
| **Speaker invitations** | Organizers invite a speaker from their public page to one of their events, optionally for a specific talk, with a personal note. Speakers accept or decline in **Invitations**. Accepting puts the session straight onto the programme as an accepted "Invited" session and adds it to the speaker's tracker. The Programme tab lists all invitations and lets you withdraw open ones |
| **Organizer workspace** (`/organize`) | Create an event with a cover photo, dates, tracks, formats and limits, then publish or unpublish the CfP. Add a review team (owners and reviewers), score proposals 1–5 with comments, and optionally review anonymously. Accept, waitlist or reject, then **publish decisions**, which updates every speaker's tracker. Build the programme by track with a ranked waitlist, and publish it to the public event page |

Not built yet: the browser-extension autofill companion, AI rewrite/condense helpers, email notifications (decisions, team invites), and scheduling sessions into time slots. See [Roadmap](#roadmap).

## Stack

- **Next.js 16** (App Router, Cache Components + Partial Prefetching), React 19, TypeScript, Tailwind CSS v4
- **PostgreSQL** via **Prisma 7** (`@prisma/adapter-pg`): Azure Database for PostgreSQL in production
- **Better Auth**: email + password, GitHub, Google, LinkedIn and Microsoft Entra ID
- **Azure Blob Storage** for headshots
- **Zod** for validation

## Local development

Prerequisites: Node 22+ and a PostgreSQL database.

```bash
npm install                      # also runs `prisma generate`
cp .env.example .env             # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
docker compose up -d             # local Postgres on :5432 (or point DATABASE_URL elsewhere)
npm run db:migrate               # apply migrations
npm run dev                      # http://localhost:3000
```

In development, email + password sign-in is enabled automatically, so you don't need OAuth apps. Uploaded headshots go to `public/uploads/` until `AZURE_STORAGE_CONNECTION_STRING` is set.

Useful scripts: `npm run typecheck`, `npm run lint`, `npm run db:studio`.

### Sign-in providers

Each provider is enabled once both its client ID and secret are set in the environment. The callback URL is always `{BETTER_AUTH_URL}/api/auth/callback/{provider}`:

| Provider | Where to register | Callback suffix |
| --- | --- | --- |
| GitHub | GitHub → Settings → Developer settings → OAuth Apps | `/api/auth/callback/github` |
| Google | Google Cloud Console → Credentials | `/api/auth/callback/google` |
| LinkedIn | LinkedIn Developers (product: *Sign In with LinkedIn using OpenID Connect*) | `/api/auth/callback/linkedin` |
| Microsoft | Entra ID → App registrations (supported account types: *any org directory + personal accounts*, `MICROSOFT_TENANT_ID=common`) | `/api/auth/callback/microsoft` |

Email + password is **off in production** unless `AUTH_EMAIL_PASSWORD=true`. Passcode (email code) sign-in is always available.

### Email

Sign-in codes, email verification, password resets and email changes go through `src/lib/mailer.ts`. Set `AZURE_COMMUNICATION_CONNECTION_STRING` and `EMAIL_FROM` (a verified Azure Communication Services sender) to deliver them. Without those settings, every message is only recorded in **Admin → Email outbox**, which works for development but not for production. Codes in delivered messages are redacted from the outbox.

### Admins

Set `ADMIN_EMAILS` to a comma-separated list. Those addresses get the platform admin role when they sign up, and existing admins can grant the role to others under **Admin → Users**.

## Deploying to Azure

See **[docs/deploy-azure.md](docs/deploy-azure.md)** for the step-by-step guide. In short:

- [`infra/main.bicep`](infra/main.bicep) provisions Container Apps, Container Registry, PostgreSQL Flexible Server, Blob Storage, Azure Maps, Communication Services Email and Log Analytics in one resource group.
- [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) deploys every push to `main`: typecheck and lint → `az acr build` → `prisma migrate deploy` → `az containerapp update` → health check. It signs in to Azure with OIDC, so no stored credentials.
- The image is built from the repo's `Dockerfile` (Next.js standalone output) and exposes `/api/health` for probes.

## Project layout

```
prisma/schema.prisma        Data model (User/Session/Account/Verification = Better Auth tables)
src/app/(app)/              Authenticated pages: dashboard, profile, sessions, submissions, import, export
src/app/api/                Better Auth handler, headshot upload, exports
src/app/sign-in/            Sign-in / sign-up
src/components/             UI (forms, copy panel, importers)
src/lib/dal.ts              Data access layer: requireUser() — call it in every page, action and route
src/lib/actions/            Server actions (all scoped to the signed-in user)
src/lib/importers/          Sessionize, Pretalx, CSV parsers + idempotent persistence
src/lib/organizer.ts        requireEventAccess(): event membership / role checks for the organizer side
src/app/events/             Public pages: open calls, event page + programme, proposal submission
src/app/(app)/organize/     Organizer workspace: events, proposals, reviews, programme, settings
public/images/events/       Bundled event photography (Unsplash License, see CREDITS.md)
src/lib/platforms.ts        Per-platform character-limit presets for the copy panel
src/lib/safe-fetch.ts       SSRF-guarded fetch for user-supplied URLs (Pretalx instances)
src/proxy.ts                Optimistic redirect to /sign-in (real checks live in the DAL)
```

**Naming:** a speaker's talk is the `Talk` model in code and is called a "Session" in the UI, because `Session` is already the Better Auth login-session table.

**Tenant isolation:** every speaker query filters on `userId` from the server-side session. Organizer pages and actions go through `requireEventAccess` / `eventAccessOrNull`, so non-members get a 404 and only owners can change settings or decide on proposals. Foreign keys sent by the client (for example `talkId`) are checked for ownership before they're written.

**Proposals are snapshots.** When a speaker submits, the title, abstract, takeaways and the rest are copied into the proposal, so later edits to the library session don't change what reviewers are scoring. Decisions stay internal until an owner publishes them.

## Importer notes

- **Sessionize**: the organizer must enable an *API / Embed* endpoint. SpeakerDesk reads `https://sessionize.com/api/v2/{id}/view/All`, the speaker picks themselves, and their sessions are imported as accepted submissions. The API doesn't include the event name, so the user enters it.
- **Pretalx**: works with pretalx.com or self-hosted instances. Without an API token, only the published schedule is visible. The token is used for that one request and is never stored. Requests go through the SSRF guard (https only; private, loopback and link-local addresses are blocked; redirects aren't followed).
- **CSV**: needs a `title` column. Other columns are matched by common aliases (e.g. *Learning Objectives* → takeaways, *Session Type* → format).
- **De-duplication**: a session with the same source reference or the same title is reused, and a submission with the same platform + external ID is skipped.

## Roadmap

1. **Browser extension** (WXT or Plasmo) that autofills Sessionize, run.events and PaperCall CfP forms from a session. It needs a token-authenticated read API for the extension.
2. **AI polish**: condense an abstract to N characters and generate takeaways from an outline (Claude via structured output).
3. **Email verification and magic links** (Azure Communication Services), plus account linking UI.
4. **Abstract version history**, and per-event custom answers on submissions.
5. **Infrastructure as code** (Bicep) and a GitHub Actions pipeline: build → migrate → deploy.
6. **Sponsorship extras**: invoices and payment links (e.g. Stripe), logo upload to Blob Storage, sponsor team members, and expenses on the budget.
7. **Email notifications** for team invites, speaker invitations and decisions. The mailer (`src/lib/mailer.ts`, Azure Communication Services) already delivers passcodes, verification and reset codes; these notifications still need to be hooked into it.
8. **Organizer extras**: email notifications for decisions and team invites, custom CfP questions, a time-slot schedule builder, speaker confirmation after acceptance, and travel/logistics collection.
