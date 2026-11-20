import Link from "next/link";
import { CfpBadge, CoverImage, formatDate, formatDateRange } from "@/components/ui";
import { cfpState, type EventFormat, eventWhere } from "@/lib/domain";

export type EventCardData = {
  slug: string;
  name: string;
  tagline: string;
  location: string;
  format: EventFormat;
  onlinePlatform: string;
  coverImage: string;
  coverFit: string;
  coverPosition: string;
  startDate: Date | null;
  endDate: Date | null;
  cfpPublished: boolean;
  cfpOpensAt: Date | null;
  cfpClosesAt: Date | null;
};

/** Public event card: photo on top, details below. */
export function EventCard({ event, href }: { event: EventCardData; href?: string }) {
  const state = cfpState(event);
  return (
    <Link href={href ?? `/events/${event.slug}`} className="group block overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-ink/30">
      <div className="relative aspect-[16/9] overflow-hidden bg-night">
        <CoverImage src={event.coverImage} fit={event.coverFit} position={event.coverPosition} sizes="(min-width: 1024px) 33vw, 100vw" className="transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute left-3 top-3"><CfpBadge state={state} /></div>
      </div>
      <div className="p-4">
        <p className="text-xs text-ink-soft">{formatDateRange(event.startDate, event.endDate)}{eventWhere(event) && ` · ${eventWhere(event)}`}</p>
        <h3 className="mt-1 font-display tracking-tight text-xl font-semibold leading-snug text-ink group-hover:text-brand-700">{event.name}</h3>
        {event.tagline && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{event.tagline}</p>}
        {state === "open" && event.cfpClosesAt && <p className="mt-3 text-xs font-medium text-brand-700">Submit by {formatDate(event.cfpClosesAt)}</p>}
      </div>
    </Link>
  );
}
