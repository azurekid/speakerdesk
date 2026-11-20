import { Clock, Gauge, Globe, MapPin, PlayCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InviteSpeakerForm } from "@/components/speakers/invite-speaker-form";
import { ButtonLink, ExternalLink, FormatBadge, Skeleton } from "@/components/ui";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { LEVEL_LABELS } from "@/lib/domain";
import { PUBLIC_PROFILE_SELECT } from "@/lib/speaker-directory";

export const metadata: Metadata = { title: "Speaker" };

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
  const talks = await prisma.talk.findMany({
    where: { userId: p.userId, published: true, archived: false },
    orderBy: { updatedAt: "desc" },
    include: { submissions: { where: { status: "ACCEPTED" }, select: { eventName: true } } },
  });
  const links = ([["Website", p.websiteUrl], ["LinkedIn", p.linkedinUrl], ["GitHub", p.githubUrl], ["X", p.xUrl], ["Bluesky", p.blueskyUrl], ["Mastodon", p.mastodonUrl], ["YouTube", p.youtubeUrl]] as const).filter(([, u]) => u);
  const bio = p.bioMedium || p.bioLong || p.bioShort;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-10">
        <header className="flex flex-wrap items-center gap-6">
          {p.headshotSquareUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- speaker-provided image host
            <img src={p.headshotSquareUrl} alt={p.fullName} className="size-32 rounded-full object-cover" />
          ) : (
            <span className="grid size-32 place-items-center rounded-full bg-neutral-100 text-4xl font-semibold">{p.fullName[0]}</span>
          )}
          <div className="min-w-0">
            <h1 className="text-4xl font-semibold tracking-tight">{p.fullName}</h1>
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

        <section>
          <h2 className="text-xl font-semibold tracking-tight">Talks</h2>
          {talks.length === 0 ? (
            <p className="mt-2 text-ink-soft">No published talks yet.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {talks.map((t) => (
                <li key={t.id} id={`talk-${t.id}`} className="rounded-2xl border border-line bg-surface p-6">
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
