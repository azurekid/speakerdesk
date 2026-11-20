import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cx, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { popularTopics, searchSpeakers } from "@/lib/speaker-directory";

export const metadata: Metadata = { title: "Find speakers" };

type Props = PageProps<"/speakers">;

export default function SpeakersPage(props: Props) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <PageHeader eyebrow="Speaker directory" title="Find speakers" description="Speakers who published their talks on SpeakerDesk. Organizers can invite them straight to their event." />
      <Suspense fallback={<Skeleton rows={4} />}>
        <Directory searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Directory({ searchParams }: { searchParams: Props["searchParams"] }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const topic = typeof sp.topic === "string" ? sp.topic : undefined;
  const [speakers, topics] = await Promise.all([searchSpeakers(q, topic), popularTopics()]);

  return (
    <div className="space-y-6">
      <form action="/speakers" className="flex max-w-xl gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input name="q" defaultValue={q} placeholder="Search by name, topic or talk title…" className="control pl-9" />
        </div>
        {topic && <input type="hidden" name="topic" value={topic} />}
        <button className="rounded-lg bg-ink px-4 text-sm font-medium text-paper">Search</button>
      </form>
      {topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topic && <Link href={`/speakers${q ? `?q=${encodeURIComponent(q)}` : ""}`} className="rounded-full bg-ink px-3 py-1 text-xs text-paper">× {topic}</Link>}
          {topics.filter((t) => t !== topic).map((t) => (
            <Link key={t} href={`/speakers?${new URLSearchParams({ ...(q ? { q } : {}), topic: t })}`} className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-soft hover:border-neutral-400">{t}</Link>
          ))}
        </div>
      )}
      {speakers.length === 0 ? (
        <EmptyState title={q || topic ? "No speakers match" : "No public speakers yet"} photo="/images/events/microphone.jpg">
          {q || topic ? "Try a broader search." : "Speakers can publish their page from their profile."}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {speakers.map((s) => (
            <li key={s.userId}>
              <Link href={`/speakers/${s.slug}`} className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition hover:border-neutral-400">
                <div className="flex items-center gap-4">
                  {s.headshotSquareUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- speaker-provided image host
                    <img src={s.headshotSquareUrl} alt="" className="size-16 rounded-full object-cover" />
                  ) : (
                    <span className="grid size-16 place-items-center rounded-full bg-neutral-100 text-xl font-semibold">{s.fullName[0]}</span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold tracking-tight group-hover:text-brand-700">{s.fullName}</p>
                    <p className="line-clamp-2 text-sm text-ink-soft">{s.tagline}</p>
                  </div>
                </div>
                {s.topics.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1">
                    {s.topics.slice(0, 5).map((t) => <span key={t} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-ink-soft">{t}</span>)}
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between pt-4 text-xs text-ink-soft">
                  <span>{[s.city, s.country].filter(Boolean).join(", ") || " "}</span>
                  <span className={cx(s.openToInvites ? "text-emerald-700" : "")}>
                    {s.user.talks.length} talk{s.user.talks.length === 1 ? "" : "s"}{s.openToInvites ? " · open to invites" : ""}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
