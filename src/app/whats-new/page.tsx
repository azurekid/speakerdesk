import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { Eyebrow } from "@/components/ui";
import { AUDIENCE_LABELS, AUDIENCES, type Release, RELEASES } from "@/lib/whats-new";

export const metadata: Metadata = {
  title: "What's new",
  description: "The latest SpeakerDesk features and improvements for speakers, event organizers and sponsors.",
  alternates: { canonical: "/whats-new" },
  openGraph: { title: "What's new on SpeakerDesk", url: "/whats-new" },
};

/** Anchor for a release; several releases can share a date. */
const releaseId = (r: Release) => `${r.date}-${r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default function WhatsNewPage() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <header className="border-b border-line pb-8">
          <Eyebrow>Product updates</Eyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">What&apos;s new</h1>
          <p className="mt-3 max-w-2xl text-ink-soft">New features and improvements for speakers, organizers and sponsors, newest first.</p>
          <nav aria-label="Jump to" className="mt-6 flex flex-wrap gap-2 text-sm">
            {AUDIENCES.filter((a) => RELEASES[0].items.some((i) => i.audience === a)).map((a) => (
              <a key={a} href={`#${releaseId(RELEASES[0])}-${a}`} className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-ink-soft hover:border-ink hover:text-ink">
                {AUDIENCE_LABELS[a]}
              </a>
            ))}
          </nav>
        </header>
        {RELEASES.map((r) => <ReleaseEntry key={r.date + r.title} release={r} />)}
      </main>
    </div>
  );
}

function ReleaseEntry({ release }: { release: Release }) {
  return (
    <article id={releaseId(release)} className="grid gap-x-10 gap-y-4 border-b border-line py-12 last:border-b-0 md:grid-cols-[10rem_1fr]">
      <div>
        <time dateTime={release.date} className="text-sm font-medium text-ink-soft md:sticky md:top-6">{formatDate(release.date)}</time>
      </div>
      <div className="min-w-0">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{release.title}</h2>
        {release.summary && <p className="mt-2 text-ink-soft">{release.summary}</p>}
        {AUDIENCES.map((audience) => {
          const items = release.items.filter((i) => i.audience === audience);
          if (!items.length) return null;
          return (
            <section key={audience} id={`${releaseId(release)}-${audience}`} className="mt-10 scroll-mt-6">
              <h3 className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-brand-700">
                {AUDIENCE_LABELS[audience]}
                <span className="h-px flex-1 bg-line" />
              </h3>
              <ul className="mt-4 divide-y divide-line">
                {items.map((item) => (
                  <li key={item.title} className="py-4">
                    <p className="font-medium text-ink">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{item.body}</p>
                    <figure className="mt-4 overflow-hidden rounded-xl border border-line bg-neutral-100">
                      <Image
                        src={`/whats-new/${item.shot}.jpg`}
                        alt={`Screenshot: ${item.title}`}
                        width={1280}
                        height={800}
                        sizes="(min-width: 1024px) 720px, (min-width: 768px) 60vw, 100vw"
                        className="h-auto w-full"
                      />
                    </figure>
                    {item.href && (
                      <Link href={item.href} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-ink underline decoration-brand-500 decoration-2 underline-offset-4 hover:text-brand-700">
                        Try it <ArrowRight className="size-3.5" />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </article>
  );
}
