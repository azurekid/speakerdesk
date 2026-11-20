import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountButton } from "@/components/account-button";
import { EventCard } from "@/components/events/event-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { ButtonLink, Eyebrow, Logo } from "@/components/ui";
import { getOpenCalls } from "@/lib/public-events";

const SPEAKER_POINTS = [
  "One profile with short, medium and long bios and hosted headshots",
  "A library of sessions with pitches, abstracts and key takeaways",
  "Paste-ready copy for Sessionize, run.events, Pretalx and PaperCall",
  "A tracker for every CfP, deadline and decision",
];
const ORGANIZER_POINTS = [
  "Publish a call for papers with tracks, formats and character limits",
  "Proposals arrive complete — no chasing bios or headshots",
  "Score with your review team, blind if you like",
  "Accept, waitlist or reject, then publish decisions and your programme",
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero: a real stage, not a gradient */}
      <section className="relative isolate min-h-[640px] overflow-hidden bg-night text-white">
        <Image src="/images/events/main-stage.jpg" alt="A speaker on a large conference stage in front of a full audience" fill priority sizes="100vw" className="-z-10 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/55 to-black/10" />
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Logo light />
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/events" className="hidden text-white/80 hover:text-white sm:inline">Open calls</Link>
            <Link href="/speakers" className="hidden text-white/80 hover:text-white sm:inline">Speakers</Link>
            <ThemeToggle className="text-white/80 hover:bg-white/10 hover:text-white" />
            <AccountButton variant="light" />
          </nav>
        </header>
        <div className="mx-auto max-w-6xl px-6 pb-24 pt-20 sm:pt-28">
          <Eyebrow className="text-brand-200">For speakers and the people who book them</Eyebrow>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-[1.02] tracking-tighter tracking-tight sm:text-7xl">
            Every talk you give starts with a call for papers.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/80">
            SpeakerDesk keeps your sessions ready to submit — and gives organizers one place to collect, review and select them.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href="/sign-in" variant="accent" size="lg">Start as a speaker</ButtonLink>
            <ButtonLink href="/sign-in?next=/organize/new" variant="light" size="lg">Run a call for papers</ButtonLink>
          </div>
        </div>
      </section>

      {/* Two audiences, each with its own photograph */}
      <section className="mx-auto grid max-w-6xl gap-px overflow-hidden px-6 py-20 lg:grid-cols-2 lg:gap-12">
        <Audience photo="/images/events/speaker-screen.jpg" alt="A presenter in front of a large projected slide" eyebrow="For speakers" title="Write it once. Submit it anywhere." points={SPEAKER_POINTS} cta={{ href: "/sign-in", label: "Build your speaker profile" }} />
        <Audience photo="/images/events/audience-question.jpg" alt="An audience member asking a question in a packed hall" eyebrow="For organizers" title="From open call to finished programme." points={ORGANIZER_POINTS} cta={{ href: "/sign-in?next=/organize/new", label: "Create your event" }} />
      </section>

      <section className="mx-auto mb-20 max-w-6xl px-6">
        <div className="grid overflow-hidden rounded-2xl bg-night text-white md:grid-cols-2">
          <div className="relative min-h-64">
            <Image src="/images/events/networking.jpg" alt="Attendees talking over dinner at a conference" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          </div>
          <div className="p-10">
            <Eyebrow className="text-brand-200">For sponsors</Eyebrow>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Back the events your customers go to.</h2>
            <p className="mt-3 text-white/75">Compare packages across events, add the coffee bar or the after-party, request booth power and lead scanning in one go — and track every deliverable until the doors open.</p>
            <ButtonLink href="/sign-in?next=/sponsor" variant="accent" className="mt-6">Find events to sponsor</ButtonLink>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>Now accepting proposals</Eyebrow>
              <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight">Open calls for papers</h2>
            </div>
            <Link href="/events" className="inline-flex items-center gap-1 text-sm font-medium text-ink hover:text-brand-700">All open calls <ArrowRight className="size-4" /></Link>
          </div>
          <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-neutral-100" />}>
            <OpenCalls />
          </Suspense>
        </div>
      </section>

      <section className="relative isolate overflow-hidden bg-night text-white">
        <Image src="/images/events/meetup.jpg" alt="" fill sizes="100vw" className="-z-10 object-cover opacity-40" />
        <div className="mx-auto max-w-6xl px-6 py-24">
          <h2 className="max-w-2xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">From a meetup back room to the main stage.</h2>
          <p className="mt-4 max-w-xl text-white/80">Free for speakers. Bring your history from Sessionize or Pretalx in a minute.</p>
          <ButtonLink href="/sign-in" variant="accent" size="lg" className="mt-8">Get started</ButtonLink>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-ink-soft">
        <Logo className="text-base" />
        <nav className="flex gap-4">
          <Link href="/terms" className="hover:text-ink">Terms of use</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        </nav>
        <p>Event photography via Unsplash.</p>
      </footer>
    </div>
  );
}

function Audience({ photo, alt, eyebrow, title, points, cta }: { photo: string; alt: string; eyebrow: string; title: string; points: string[]; cta: { href: string; label: string } }) {
  return (
    <article className="mb-12 lg:mb-0">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
        <Image src={photo} alt={alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
      </div>
      <Eyebrow className="mt-6">{eyebrow}</Eyebrow>
      <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">{title}</h2>
      <ul className="mt-4 space-y-2 text-ink-soft">
        {points.map((p) => (
          <li key={p} className="flex gap-3"><span className="mt-2.5 h-px w-4 shrink-0 bg-brand-500" />{p}</li>
        ))}
      </ul>
      <Link href={cta.href} className="mt-6 inline-flex items-center gap-1 font-medium text-ink underline decoration-brand-500 decoration-2 underline-offset-4 hover:text-brand-700">
        {cta.label} <ArrowRight className="size-4" />
      </Link>
    </article>
  );
}

async function OpenCalls() {
  await connection();
  const events = await getOpenCalls(3);
  if (!events.length) {
    return <p className="rounded-lg border border-dashed border-line px-6 py-10 text-center text-ink-soft">No open calls right now — organizers, <Link href="/sign-in?next=/organize/new" className="font-medium text-ink underline">publish yours</Link>.</p>;
  }
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e) => <EventCard key={e.id} event={e} />)}
    </div>
  );
}
