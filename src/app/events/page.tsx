import type { Metadata } from "next";
import { Suspense } from "react";
import { EventCard } from "@/components/events/event-card";
import { ButtonLink, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { getOpenCalls, getPastEvents } from "@/lib/public-events";

export const metadata: Metadata = {
  title: "Open calls for papers: submit a talk to tech conferences",
  description: "Conferences and meetups accepting talk proposals right now. Find an open call for papers and submit a session straight from your SpeakerDesk library.",
  alternates: { canonical: "/events" },
  openGraph: { title: "Open calls for papers", url: "/events" },
};

export default function OpenCallsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <PageHeader
        eyebrow="Now accepting proposals"
        title="Open calls for papers"
        description="Events running their CfP on SpeakerDesk. Submit straight from your session library."
        actions={<ButtonLink href="/sign-in?next=/organize/new" variant="secondary">Publish your CfP</ButtonLink>}
      />
      <Suspense fallback={<Skeleton rows={3} />}>
        <List />
      </Suspense>
      <Suspense fallback={null}>
        <PastEvents />
      </Suspense>
    </main>
  );
}

async function List() {
  const events = await getOpenCalls(60);
  if (!events.length) {
    return (
      <EmptyState title="No open calls right now" photo="/images/events/hall.jpg" action={<ButtonLink href="/organize/new">Publish a call for papers</ButtonLink>}>
        Check back soon, or run your own event&apos;s CfP here.
      </EmptyState>
    );
  }
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e) => <EventCard key={e.id} event={e} />)}
    </div>
  );
}

/** Closed and finished events: every published event gets a crawlable link from here. */
async function PastEvents() {
  const events = await getPastEvents(200);
  if (!events.length) return null;
  return (
    <section className="mt-16" aria-labelledby="past-events">
      <h2 id="past-events" className="font-display text-2xl font-semibold tracking-tight">Past and closed events</h2>
      <p className="mt-1 text-sm text-ink-soft">Events that have closed their call for papers or published their programme.</p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((e) => <EventCard key={e.id} event={e} />)}
      </div>
    </section>
  );
}
