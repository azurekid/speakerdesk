import { ExternalLink as ExternalIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { EventTabs } from "@/components/organizer/controls";
import { WorkspaceTip } from "@/components/organizer/workspace-tips";
import { CfpBadge, CoverImage, formatDateRange } from "@/components/ui";
import { isEventPublic, cfpState, eventWhere } from "@/lib/domain";
import { requireEventAccess } from "@/lib/organizer";
import { ROLE_LABELS } from "@/lib/permissions";

export default function EventWorkspaceLayout({ children, params }: LayoutProps<"/organize/[eventId]">) {
  return (
    <>
      <Suspense fallback={<div className="mb-6 h-28 animate-pulse rounded-lg bg-neutral-200/60" />}>
        <Header params={params} />
      </Suspense>
      {children}
    </>
  );
}

async function Header({ params }: { params: LayoutProps<"/organize/[eventId]">["params"] }) {
  const { eventId } = await params;
  const { event, role } = await requireEventAccess(eventId, "VOLUNTEER");
  const state = cfpState(event);
  return (
    <header className="mb-8">
      <Link href="/organize" className="text-xs text-ink-soft hover:text-ink">← My events</Link>
      <div className="mt-3 flex flex-wrap items-start gap-4 sm:items-center sm:gap-5">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-night sm:size-20">
          <CoverImage src={event.coverImage} fit={event.coverFit} position={event.coverPosition} sizes="80px" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <CfpBadge state={state} />
            <span className="text-xs text-ink-soft">You&apos;re {ROLE_LABELS[role].toLowerCase()}</span>
          </div>
          <h1 className="mt-1 break-words font-display text-2xl font-semibold tracking-tight sm:text-3xl">{event.name}</h1>
          <p className="text-sm text-ink-soft">{formatDateRange(event.startDate, event.endDate)}{eventWhere(event) && ` · ${eventWhere(event)}`}</p>
        </div>
        {isEventPublic(event) && (
          <Link href={`/events/${event.slug}`} target="_blank" className="inline-flex min-h-10 items-center gap-1 text-sm text-ink-soft hover:text-ink max-sm:w-full">
            Public page <ExternalIcon className="size-3.5" />
          </Link>
        )}
      </div>
      <div className="mt-6">
        <Suspense fallback={<div className="h-8 border-b border-line" />}>
          <EventTabs eventId={eventId} role={role} />
        </Suspense>
      </div>
      <div className="mt-6 empty:hidden">
        <Suspense fallback={null}>
          <WorkspaceTip eventId={eventId} />
        </Suspense>
      </div>
    </header>
  );
}
