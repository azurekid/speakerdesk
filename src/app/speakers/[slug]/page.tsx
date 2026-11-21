import { Clock, Gauge, Globe, MapPin, PlayCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ShareMenu } from "@/components/share";
import { InviteSpeakerForm } from "@/components/speakers/invite-speaker-form";
import { appUrl } from "@/lib/app-url";
import { jsonLd, SITE_URL } from "@/lib/site";
import { ButtonLink, ExternalLink, FormatBadge, Skeleton } from "@/components/ui";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { LEVEL_LABELS } from "@/lib/domain";
import { PUBLIC_PROFILE_SELECT } from "@/lib/speaker-directory";
import { publicBadgesFor } from "@/lib/badge-queries";
import { BadgeMedal } from "@/components/badge-medal";

/** Link previews for a public speaker page: name, tagline and headshot. */
export async function generateMetadata({ params }: PageProps<"/speakers/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await prisma.speakerProfile.findFirst({ where: { slug, publicProfile: true }, select: { fullName: true, tagline: true, bioShort: true, headshotSquareUrl: true } });
  if (!p) return { title: "Speaker" };
  const url = `${SITE_URL}/speakers/${slug}`;
  const description = (p.tagline || p.bioShort || `${p.fullName} on SpeakerDesk`).slice(0, 200);
  const images = p.headshotSquareUrl ? [{ url: p.headshotSquareUrl, alt: p.fullName }] : undefined;
  return {
    title: p.fullName,
    description,
    alternates: { canonical: url },
    openGraph: { type: "profile", url, title: `${p.fullName}, speaker`, description, siteName: "SpeakerDesk", images },
    twitter: { card: "summary", title: p.fullName, description, images: images?.map((i) => i.url) },
  };
}

type Props = PageProps<"/speakers/[slug]">;

export default function SpeakerPage(props: Props) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <Suspense fallback={<Skeleton rows={4} />}>
        <Speaker params={props.params} />
      </Suspense>
    </main>
  );
}

async function Speaker({ params }: { params: Props["params"] }) {
  const { slug } = await params;
  const p = await prisma.speakerProfile.findFirst({ where: { slug, publicProfile: true }, select: PUBLIC_PROFILE_SELECT });
  if (!p) notFound();
  const badges = await publicBadgesFor(p.userId);
  const talks = await prisma.talk.findMany({
    where: { userId: p.userId, published: true, archived: false },
    orderBy: { updatedAt: "desc" },
    include: { submissions: { where: { status: "ACCEPTED" }, select: { eventName: true } } },
  });
  const links = ([["Website", p.websiteUrl], ["LinkedIn", p.linkedinUrl], ["GitHub", p.githubUrl], ["X", p.xUrl], ["Bluesky", p.blueskyUrl], ["Mastodon", p.mastodonUrl], ["YouTube", p.youtubeUrl]] as const).filter(([, u]) => u);
  const bio = p.bioMedium || p.bioLong || p.bioShort;

  // schema.org ProfilePage + Person: helps search engines connect this page to the speaker.
  const personLd = jsonLd({
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: `${SITE_URL}/speakers/${slug}`,
    mainEntity: {
      "@type": "Person",
      name: p.fullName,
      description: p.tagline || undefined,
      image: p.headshotSquareUrl || undefined,
      jobTitle: p.jobTitle || undefined,
      worksFor: p.company ? { "@type": "Organization", name: p.company } : undefined,
      homeLocation: p.city || p.country ? { "@type": "Place", name: [p.city, p.country].filter(Boolean).join(", ") } : undefined,
      knowsAbout: p.topics.length ? p.topics : undefined,
      sameAs: links.map(([, u]) => u),
    },
  });

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: personLd }} />
      <div className="min-w-0 space-y-10">
        <header className="flex flex-wrap items-center gap-6">
          {p.headshotSquareUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- speaker-provided image host
            <img src={p.headshotSquareUrl} alt={p.fullName} className="size-32 rounded-full object-cover" />
          ) : (
            <span className="grid size-32 place-items-center rounded-full bg-neutral-100 text-4xl font-semibold">{p.fullName[0]}</span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3">
              <h1 className="text-4xl font-semibold tracking-tight">{p.fullName}</h1>
              <ShareMenu label="Share profile" url={`${appUrl()}/speakers/${slug}`} text={`${p.fullName}${p.tagline ? `, ${p.tagline}` : ""}`} subject={`${p.fullName} on SpeakerDesk`} />
            </div>
            {p.pronouns && <p className="text-sm text-ink-soft">{p.pronouns}</p>}
            <p className="mt-1 text-lg text-ink-soft">{p.tagline}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
              {(p.city || p.country) && <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" />{[p.city, p.country].filter(Boolean).join(", ")}</span>}
              {p.availabilityNote && <span className="inline-flex items-center gap-1.5"><Globe className="size-4" />{p.availabilityNote}</span>}
            </div>
          </div>
        </header>

        {p.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {p.topics.map((t) => <Link key={t} href={`/speakers?topic=${encodeURIComponent(t)}`} className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-soft hover:border-neutral-400">{t}</Link>)}
          </div>
        )}

        {bio && (
          <section>
            <h2 className="text-xl font-semibold tracking-tight">About</h2>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed text-ink-soft">{bio}</p>
            {links.length > 0 && (
              <p className="mt-3 flex flex-wrap gap-4 text-sm">{links.map(([label, url]) => <ExternalLink key={label} href={url}>{label}</ExternalLink>)}</p>
            )}
          </section>
        )}

        {badges.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold tracking-tight">Badges</h2>
            <ul className="mt-4 flex flex-wrap gap-3">
              {badges.map((b) => (
                <li key={b.id}>
                  <Link href={`/credentials/${b.id}`} className="flex items-center gap-3 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-4 hover:border-neutral-400" title={b.badge.description}>
                    <BadgeMedal icon={b.badge.icon} color={b.badge.color} size="sm" />
                    <span className="text-sm leading-tight"><span className="block font-medium">{b.badge.name}</span><span className="block text-xs text-ink-soft">{b.event.name}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="text-xl font-semibold tracking-tight">Talks</h2>
          {talks.length === 0 ? (
            <p className="mt-2 text-ink-soft">No published talks yet.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {talks.map((t) => (
                <li key={t.id} id={`talk-${t.id}`} className="scroll-mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                    <FormatBadge format={t.format} />
                    <span className="inline-flex items-center gap-1"><Clock className="size-3.5" />{t.durationMinutes} min</span>
                    <span className="inline-flex items-center gap-1"><Gauge className="size-3.5" />{LEVEL_LABELS[t.level]}</span>
                    {t.primaryTrack && <span>· {t.primaryTrack}</span>}
                  </div>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight">{t.title}</h3>
                  {t.subtitle && <p className="text-ink-soft">{t.subtitle}</p>}
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft [overflow-wrap:anywhere]">{t.abstractLong || t.abstractShort}</p>
                  {t.takeaways.length > 0 && (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{t.takeaways.map((k, i) => <li key={i}>{k}</li>)}</ul>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                    {t.tags.length > 0 && <span>{t.tags.map((x) => `#${x}`).join(" ")}</span>}
                    {t.submissions.length > 0 && <span>Given at {[...new Set(t.submissions.map((s) => s.eventName))].slice(0, 3).join(", ")}</span>}
                    {t.videoUrl && <a href={t.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink hover:text-brand-700"><PlayCircle className="size-3.5" />Watch a recording</a>}
                    <span className="ml-auto"><ShareMenu url={`${appUrl()}/speakers/${slug}#talk-${t.id}`} text={`“${t.title}”, a talk by ${p.fullName}`} subject={`${t.title} by ${p.fullName}`} /></span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg font-semibold tracking-tight">Invite {p.fullName.split(" ")[0]} to speak</h2>
          <Suspense fallback={<Skeleton rows={1} />}>
            <InvitePanel speakerId={p.userId} speakerName={p.fullName} open={p.openToInvites} talks={talks.map((t) => ({ id: t.id, title: t.title }))} slug={slug} />
          </Suspense>
        </div>
      </aside>
    </div>
  );
}

async function InvitePanel({ speakerId, speakerName, open, talks, slug }: { speakerId: string; speakerName: string; open: boolean; talks: { id: string; title: string }[]; slug: string }) {
  if (!open) return <p className="mt-2 text-sm text-ink-soft">{speakerName.split(" ")[0]} isn&apos;t taking invitations right now.</p>;
  const user = await getCurrentUser();
  if (!user) {
    return (
      <>
        <p className="mt-2 text-sm text-ink-soft">Organizers can invite speakers straight to their event.</p>
        <ButtonLink href={`/sign-in?next=/speakers/${slug}`} className="mt-4 w-full">Sign in as organizer</ButtonLink>
      </>
    );
  }
  if (user.id === speakerId) {
    return (
      <>
        <p className="mt-2 text-sm text-ink-soft">This is how organizers see your page.</p>
        <ButtonLink href="/profile" variant="secondary" className="mt-4 w-full">Edit speaker page</ButtonLink>
      </>
    );
  }
  const events = await prisma.event.findMany({
    where: { members: { some: { userId: user.id, role: { in: ["OWNER", "ORGANIZER"] } } } },
    select: { id: true, name: true },
    orderBy: { startDate: { sort: "asc", nulls: "last" } },
  });
  if (!events.length) {
    return (
      <>
        <p className="mt-2 text-sm text-ink-soft">Create an event first, then invite speakers to it.</p>
        <ButtonLink href="/organize/new" className="mt-4 w-full">Create an event</ButtonLink>
      </>
    );
  }
  return (
    <div className="mt-4">
      <InviteSpeakerForm speakerId={speakerId} speakerName={speakerName} events={events} talks={talks} />
    </div>
  );
}
