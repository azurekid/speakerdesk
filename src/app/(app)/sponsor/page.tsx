import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ButtonLink, CoverImage, EmptyState, formatDateRange, PhotoBanner, Skeleton } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { formatMoney, eventWhere } from "@/lib/domain";
import { getPackages } from "@/lib/sponsor-queries";

export const metadata: Metadata = { title: "Sponsorship opportunities" };

export default function OpportunitiesPage() {
  return (
    <div className="space-y-10">
      <PhotoBanner src="/images/events/networking.jpg" priority>
        <div className="flex min-h-[240px] flex-col justify-end p-8 sm:p-10">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Sponsorship opportunities</h1>
          <p className="mt-2 max-w-xl text-white/85">Events looking for partners. Compare packages, pick add-ons and tell organizers exactly what you need.</p>
        </div>
      </PhotoBanner>
      <Suspense fallback={<Skeleton rows={3} />}>
        <Opportunities />
      </Suspense>
    </div>
  );
}

async function Opportunities() {
  await connection();
  const user = await requireUser();
  const [org, events] = await Promise.all([
    prisma.sponsorOrg.findUnique({ where: { ownerId: user.id } }),
    prisma.event.findMany({ where: { sponsorshipOpen: true }, orderBy: [{ startDate: { sort: "asc", nulls: "last" } }] }),
  ]);
  const withPackages = await Promise.all(events.map(async (e) => ({ e, packages: await getPackages(e.id, { publishedOnly: true }) })));
  const listed = withPackages.filter((x) => x.packages.length);

  return (
    <>
      {!org && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-4">
          <p className="text-sm"><span className="font-medium">Set up your company profile</span> <span className="text-ink-soft">— organizers see it with every request.</span></p>
          <ButtonLink href="/sponsor/company" size="sm">Add company</ButtonLink>
        </div>
      )}
      {listed.length === 0 ? (
        <EmptyState title="No open sponsorships right now" photo="/images/events/hall.jpg">Check back soon — new events publish their prospectus regularly.</EmptyState>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {listed.map(({ e, packages }) => {
            const from = Math.min(...packages.map((p) => p.price));
            const tiers = packages.filter((p) => p.kind === "TIER");
            const soldOut = tiers.filter((p) => p.left === 0).length;
            return (
              <Link key={e.id} href={`/sponsor/${e.slug}`} className="group overflow-hidden rounded-2xl border border-line bg-surface transition hover:border-neutral-400">
                <div className="relative aspect-[2/1]">
                  <CoverImage src={e.coverImage} sizes="(min-width: 768px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                </div>
                <div className="p-5">
                  <p className="text-xs text-ink-soft">{formatDateRange(e.startDate, e.endDate)}{eventWhere(e) && ` · ${eventWhere(e)}`}</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight">{e.name}</h2>
                  {e.tagline && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{e.tagline}</p>}
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm">
                      <span className="text-ink-soft">From </span><span className="font-semibold">{formatMoney(from, e.currency)}</span>
                      <span className="text-ink-soft"> · {tiers.length} tier{tiers.length === 1 ? "" : "s"}{soldOut ? `, ${soldOut} sold out` : ""}</span>
                    </p>
                    <ArrowRight className="size-4 text-ink-soft transition group-hover:translate-x-0.5 group-hover:text-ink" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
