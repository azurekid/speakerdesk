import { CalendarDays, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SponsorRequestForm } from "@/components/sponsor/request-form";
import { ButtonLink, formatDateRange, PhotoBanner, Skeleton } from "@/components/ui";
import { requestSponsorship } from "@/lib/actions/sponsorship";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { SLOT_HOLDING_STATUSES, SPONSORSHIP_LABELS, eventWhere } from "@/lib/domain";
import { getPackages } from "@/lib/sponsor-queries";

export const metadata: Metadata = { title: "Sponsor prospectus" };

type Props = PageProps<"/sponsor/[slug]">;

export default function ProspectusPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <Prospectus params={props.params} />
    </Suspense>
  );
}

async function Prospectus({ params }: { params: Props["params"] }) {
  const user = await requireUser();
  const { slug } = await params;
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event || !event.sponsorshipOpen) notFound();
  const [org, packages] = await Promise.all([prisma.sponsorOrg.findUnique({ where: { ownerId: user.id } }), getPackages(event.id, { publishedOnly: true })]);
  const existing = org
    ? await prisma.sponsorship.findFirst({ where: { eventId: event.id, sponsorOrgId: org.id, status: { in: SLOT_HOLDING_STATUSES } } })
    : null;

  return (
    <div className="space-y-10">
      <PhotoBanner src={event.coverImage} priority>
        <div className="flex min-h-[300px] flex-col justify-end p-8 sm:p-10">
          <p className="text-sm font-medium text-white/80">Sponsor prospectus</p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">{event.name}</h1>
          {event.tagline && <p className="mt-2 max-w-2xl text-white/85">{event.tagline}</p>}
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/85">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" />{formatDateRange(event.startDate, event.endDate)}</span>
            {(event.venue || eventWhere(event)) && <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" />{[event.format !== "ONLINE" && event.venue, eventWhere(event)].filter(Boolean).join(", ")}</span>}
          </div>
        </div>
      </PhotoBanner>

      {(event.prospectusIntro || event.description) && (
        <section className="grid gap-6 md:grid-cols-[200px_1fr]">
          <h2 className="text-sm font-medium text-ink-soft">Why sponsor</h2>
          <div className="space-y-3 text-lg leading-relaxed">
            {event.prospectusIntro && <p className="whitespace-pre-wrap">{event.prospectusIntro}</p>}
            {event.description && <p className="whitespace-pre-wrap text-base text-ink-soft">{event.description}</p>}
            <Link href={`/events/${event.slug}`} className="inline-block text-sm text-ink-soft underline hover:text-ink">Public event page</Link>
          </div>
        </section>
      )}

      {existing ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-6 py-5">
          <p>You already have a sponsorship for this event — status: <span className="font-semibold">{SPONSORSHIP_LABELS[existing.status]}</span>.</p>
          <ButtonLink href="/sponsor/deals">View my sponsorships</ButtonLink>
        </div>
      ) : !org ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-6 py-5">
          <p>Add your company details first, so the organizers know who&apos;s asking.</p>
          <ButtonLink href={`/sponsor/company?next=/sponsor/${event.slug}`}>Add company profile</ButtonLink>
        </div>
      ) : packages.length === 0 ? (
        <p className="text-ink-soft">The organizers haven&apos;t published any packages yet.</p>
      ) : (
        <SponsorRequestForm
          currency={event.currency}
          action={requestSponsorship.bind(null, event.id)}
          packages={packages.map((p) => ({ id: p.id, kind: p.kind, name: p.name, tagline: p.tagline, price: p.price, left: p.left, benefits: p.benefits, deliverables: p.deliverables, featured: p.featured }))}
        />
      )}
    </div>
  );
}
