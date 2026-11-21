import { CalendarDays, Globe, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionButton } from "@/components/form-controls";
import { Badge, ButtonLink, buttonClass, CfpBadge, ExternalLink, formatDate, formatDateRange, PhotoBanner, Skeleton, StatusBadge } from "@/components/ui";
import { VenueMap } from "@/components/venue-map";
import { ShareButtons, ShareMenu } from "@/components/share";
import { withdrawProposal } from "@/lib/actions/proposals";
import { appUrl } from "@/lib/app-url";
import { jsonLd, SITE_URL } from "@/lib/site";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { cfpState, FORMAT_LABELS, LEVEL_LABELS, eventWhere } from "@/lib/domain";

/** Title, description and cover for link previews (LinkedIn, X, Slack, WhatsApp…). */
export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event || (!event.cfpPublished && !event.programPublished)) return { title: "Event" };
  const description = (event.tagline || event.description || `${event.name} on SpeakerDesk`).slice(0, 200);
  const url = `${SITE_URL}/events/${event.slug}`;
  const image = event.coverImage.startsWith("/") ? `${SITE_URL}${event.coverImage}` : event.coverImage;
  const title = cfpState(event) === "open" ? `Call for papers: ${event.name}` : event.name;
  return {
    title: event.name,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title, description, siteName: "SpeakerDesk", images: [{ url: image, alt: event.name }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

type Params = PageProps<"/events/[slug]">["params"];
type SearchParams = PageProps<"/events/[slug]">["searchParams"];

export default function EventPage(props: PageProps<"/events/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-6 py-10"><Skeleton rows={4} /></div>}>
      <EventDetail params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function EventDetail({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params;
  const { submitted } = await searchParams;
  const event = await prisma.event.findUnique({ where: { slug } });
  // Unpublished events are only visible to their team (via /organize).
  if (!event || (!event.cfpPublished && !event.programPublished)) notFound();
  const state = cfpState(event);

  return (
    <>
    {event.startDate && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: eventStructuredData(event) }} />}
    <main className="mx-auto max-w-6xl px-6 py-8">
      <PhotoBanner src={event.coverImage} fit={event.coverFit} position={event.coverPosition} priority className="min-h-[380px]">
        <div className="flex min-h-[380px] flex-col justify-end p-8 sm:p-12">
          <div className="mb-4"><CfpBadge state={state} /></div>
          <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[1.02] tracking-tighter tracking-tight">{event.name}</h1>
          {event.tagline && <p className="mt-3 max-w-2xl text-lg text-white/85">{event.tagline}</p>}
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/85">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" />{formatDateRange(event.startDate, event.endDate)}</span>
            {(event.venue || eventWhere(event)) && <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" />{[event.format !== "ONLINE" && event.venue, eventWhere(event)].filter(Boolean).join(", ")}</span>}
            {event.website && <a href={event.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-white"><Globe className="size-4" />Website</a>}
          </div>
        </div>
      </PhotoBanner>

      {submitted === "1" && (
        <p role="status" className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Proposal sent. It&apos;s in your <Link href="/submissions" className="font-medium underline">submission tracker</Link>, and you&apos;ll see the decision there once the organizers publish it.
        </p>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-10">
          {event.description && (
            <section>
              <h2 className="font-display tracking-tight text-2xl font-semibold">About the event</h2>
              <p className="mt-3 whitespace-pre-wrap leading-relaxed text-ink-soft">{event.description}</p>
            </section>
          )}
          {event.cfpGuidelines && (
            <section>
              <h2 className="font-display tracking-tight text-2xl font-semibold">What we&apos;re looking for</h2>
              <p className="mt-3 whitespace-pre-wrap leading-relaxed text-ink-soft">{event.cfpGuidelines}</p>
            </section>
          )}
          {event.format !== "ONLINE" && event.latitude !== null && event.longitude !== null && (
            <section>
              <h2 className="text-2xl font-semibold tracking-tight">Venue</h2>
              <p className="mt-2 text-ink-soft">{[event.venue, event.address].filter(Boolean).join(" · ")}</p>
              <VenueMap latitude={event.latitude} longitude={event.longitude} title={event.venue || event.name} className="mt-4 h-72" />
            </section>
          )}
          {event.programPublished && <Program event={event} />}
          <Sponsors eventId={event.id} />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-8 lg:self-start">
          <ShareButtons
            title="Share this event"
            url={`${appUrl()}/events/${event.slug}`}
            text={state === "open" ? `Call for papers open: ${event.name}${event.cfpClosesAt ? ` (closes ${formatDate(event.cfpClosesAt)})` : ""}` : `${event.name}, ${[formatDateRange(event.startDate, event.endDate), eventWhere(event)].filter(Boolean).join(" · ")}`}
            subject={event.name}
            className="rounded-xl border border-line bg-surface p-5"
          />
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-display tracking-tight text-xl font-semibold">Call for papers</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Opens">{event.cfpOpensAt ? formatDate(event.cfpOpensAt) : "Now"}</Row>
              <Row label="Closes">{event.cfpClosesAt ? formatDate(event.cfpClosesAt) : "Until further notice"}</Row>
              {event.formats.length > 0 && <Row label="Formats">{event.formats.map((f) => FORMAT_LABELS[f]).join(", ")}</Row>}
              {event.tracks.length > 0 && <Row label="Tracks">{event.tracks.join(", ")}</Row>}
              {event.abstractLimit && <Row label="Abstract">Up to {event.abstractLimit.toLocaleString()} characters</Row>}
              <Row label="Per speaker">Up to {event.maxProposalsPerSpeaker} proposal{event.maxProposalsPerSpeaker === 1 ? "" : "s"}</Row>
              {event.blindReview && <Row label="Review">Anonymous</Row>}
            </dl>
            {state === "open" ? (
              <ButtonLink href={`/events/${event.slug}/submit`} variant="accent" className="mt-5 w-full">Submit a session</ButtonLink>
            ) : (
              <p className="mt-5 rounded-md bg-neutral-100 px-3 py-2 text-center text-sm text-ink-soft">
                {state === "upcoming" ? `Submissions open ${formatDate(event.cfpOpensAt)}` : "Submissions are closed"}
              </p>
            )}
          </section>
          <Suspense fallback={null}>
            <MyProposals eventId={event.id} />
          </Suspense>
        </aside>
      </div>
    </main>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-2">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

/** The signed-in speaker's own proposals for this event. */
async function MyProposals({ eventId }: { eventId: string }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const proposals = await prisma.proposal.findMany({ where: { eventId, speakerId: user.id }, include: { submission: true }, orderBy: { createdAt: "desc" } });
  if (!proposals.length) return null;
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="font-display tracking-tight text-lg font-semibold">Your proposals</h2>
      <ul className="mt-3 divide-y divide-line">
        {proposals.map((p) => (
          <li key={p.id} className="py-3">
            <p className="text-sm font-medium">{p.title}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              {p.submission ? <StatusBadge status={p.submission.status} /> : <Badge>{p.withdrawn ? "Withdrawn" : "Submitted"}</Badge>}
              {!p.withdrawn && !p.decisionPublished && (
                <ActionButton action={withdrawProposal.bind(null, p.id)} variant="ghost" confirmText="Withdraw this proposal?">Withdraw</ActionButton>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function Program({ event }: { event: { id: string; slug: string; name: string } }) {
  const sessions = await prisma.proposal.findMany({
    where: { eventId: event.id, decision: "ACCEPTED", decisionPublished: true, withdrawn: false },
    include: { speaker: { include: { profile: true } } },
    orderBy: [{ track: "asc" }, { title: "asc" }],
  });
  if (!sessions.length) return null;
  return (
    <section>
      <h2 className="font-display tracking-tight text-2xl font-semibold">Programme</h2>
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {sessions.map((s) => {
          const p = s.speaker.profile;
          return (
            <li key={s.id} id={`session-${s.id}`} className="flex scroll-mt-6 gap-4 py-5">
              {p?.headshotSquareUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary CDN hosts
                <img src={p.headshotSquareUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="grid size-14 shrink-0 place-items-center rounded-full bg-neutral-200 font-display tracking-tight text-lg">{(p?.fullName || s.speaker.name)[0]}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-brand-700">{[s.track, FORMAT_LABELS[s.format], `${s.durationMinutes} min`, LEVEL_LABELS[s.level]].filter(Boolean).join(" · ")}</p>
                <h3 className="mt-1 font-display tracking-tight text-xl font-semibold">{s.title}</h3>
                <p className="text-sm text-ink-soft">{p?.fullName || s.speaker.name}{p?.tagline && `, ${p.tagline}`}</p>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft">{s.abstract}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-4">
                  {p?.websiteUrl && <ExternalLink href={p.websiteUrl} className="text-xs">Speaker website</ExternalLink>}
                  <ShareMenu
                    url={`${appUrl()}/events/${event.slug}#session-${s.id}`}
                    text={`“${s.title}” by ${p?.fullName || s.speaker.name} at ${event.name}`}
                    subject={`${s.title} at ${event.name}`}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Confirmed sponsors, biggest tier first, plus a call to action for new sponsors. */
async function Sponsors({ eventId }: { eventId: string }) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { slug: true, sponsorshipOpen: true } });
  const deals = await prisma.sponsorship.findMany({
    where: { eventId, status: { in: ["APPROVED", "INVOICED", "PAID"] } },
    include: { sponsorOrg: true, items: true },
  });
  if (!deals.length && !event?.sponsorshipOpen) return null;
  const tierOf = (d: (typeof deals)[number]) => d.items.find((i) => i.kind === "TIER");
  const groups = new Map<string, { price: number; orgs: (typeof deals)[number]["sponsorOrg"][] }>();
  for (const d of deals) {
    const t = tierOf(d);
    const key = t?.name ?? "Partners";
    const g = groups.get(key) ?? { price: t?.price ?? 0, orgs: [] };
    g.orgs.push(d.sponsorOrg);
    groups.set(key, g);
  }
  const ordered = [...groups.entries()].sort((a, b) => b[1].price - a[1].price);
  return (
    <section>
      <h2 className="text-2xl font-semibold tracking-tight">Sponsors</h2>
      {ordered.map(([tier, g], i) => (
        <div key={tier} className="mt-5">
          <p className="text-xs font-medium text-ink-soft">{tier}</p>
          <ul className={`mt-2 grid gap-3 ${i === 0 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-5"}`}>
            {g.orgs.map((o) => (
              <li key={o.id}>
                <a href={o.website || undefined} target="_blank" rel="noopener noreferrer" title={o.name} className={`grid place-items-center rounded-xl border border-line bg-surface p-4 ${i === 0 ? "h-24" : "h-16"}`}>
                  {o.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- sponsor-provided logo host
                    <img src={o.logoUrl} alt={o.name} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-sm font-semibold">{o.name}</span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {event?.sponsorshipOpen && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-night px-6 py-5 text-white">
          <p>Want to reach this audience? <span className="text-white/70">See the sponsor packages.</span></p>
          <a href={`/api/account/view?role=sponsor&next=/sponsor/${event.slug}`} className={buttonClass("accent")}>Become a sponsor</a>
        </div>
      )}
    </section>
  );
}

/**
 * schema.org Event, so the event can show up as an event result in search (date, place,
 * online/in person). Only rendered when the event has a start date, which search engines require.
 */
function eventStructuredData(event: {
  name: string; slug: string; tagline: string; description: string; coverImage: string; startDate: Date | null; endDate: Date | null;
  format: "IN_PERSON" | "ONLINE" | "HYBRID"; venue: string; address: string; location: string; website: string; onlinePlatform: string;
}) {
  const url = `${SITE_URL}/events/${event.slug}`;
  const place = { "@type": "Place", name: event.venue || event.location || event.name, address: event.address || event.location || undefined };
  const virtual = { "@type": "VirtualLocation", url: event.website || url };
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.name,
    description: (event.tagline || event.description).slice(0, 500) || undefined,
    url,
    image: [event.coverImage.startsWith("/") ? `${SITE_URL}${event.coverImage}` : event.coverImage],
    startDate: event.startDate?.toISOString().slice(0, 10),
    endDate: (event.endDate ?? event.startDate)?.toISOString().slice(0, 10),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: `https://schema.org/${event.format === "ONLINE" ? "Online" : event.format === "HYBRID" ? "Mixed" : "Offline"}EventAttendanceMode`,
    location: event.format === "ONLINE" ? virtual : event.format === "HYBRID" ? [place, virtual] : place,
  });
}
