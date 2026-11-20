import type { Metadata } from "next";
import { Suspense } from "react";
import { EventCard } from "@/components/events/event-card";
import { ButtonLink, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { getOpenCalls } from "@/lib/public-events";

export const metadata: Metadata = { title: "Open calls for papers" };

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
