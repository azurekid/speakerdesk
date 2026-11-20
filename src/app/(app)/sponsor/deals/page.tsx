import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/form-controls";
import { DeliverableChecklist } from "@/components/sponsor/deliverable-checklist";
import { Badge, ButtonLink, cx, EmptyState, formatDateRange, PageHeader, Skeleton } from "@/components/ui";
import { cancelSponsorship } from "@/lib/actions/sponsorship";
import { dealValue } from "@/lib/budget";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { formatMoney, SPONSORSHIP_LABELS, SPONSORSHIP_STYLES, type SponsorshipStatus } from "@/lib/domain";
import { sponsorRequirementLabel } from "@/lib/requirements";

export const metadata: Metadata = { title: "My sponsorships" };

type Props = PageProps<"/sponsor/deals">;

const STEPS: SponsorshipStatus[] = ["APPLIED", "APPROVED", "INVOICED", "PAID"];

export default function DealsPage(props: Props) {
  return (
    <>
      <PageHeader eyebrow="Sponsor" title="My sponsorships" actions={<ButtonLink href="/sponsor" variant="secondary">Find events</ButtonLink>} />
      <Suspense fallback={<Skeleton rows={3} />}>
        <Deals searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Deals({ searchParams }: { searchParams: Props["searchParams"] }) {
  const user = await requireUser();
  const { requested } = await searchParams;
  const deals = await prisma.sponsorship.findMany({
    where: { sponsorOrg: { ownerId: user.id } },
    include: { items: true, event: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      {requested === "1" && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Request sent. The organizers will confirm your sponsorship and follow up with an invoice.
        </p>
      )}
      {deals.length === 0 ? (
        <EmptyState title="No sponsorships yet" photo="/images/events/networking.jpg" action={<ButtonLink href="/sponsor">Browse opportunities</ButtonLink>}>
          Find an event whose audience fits yours and request a package.
        </EmptyState>
      ) : (
        deals.map((d) => {
          const deliverables = [...new Set(d.items.flatMap((i) => i.deliverables))];
          const closed = d.status === "DECLINED" || d.status === "CANCELLED";
          const stepIndex = STEPS.indexOf(d.status);
          return (
            <article key={d.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-5">
                <div>
                  <Link href={`/events/${d.event.slug}`} className="text-xl font-semibold tracking-tight hover:text-brand-700">{d.event.name}</Link>
                  <p className="text-sm text-ink-soft">{formatDateRange(d.event.startDate, d.event.endDate)}{d.event.location && ` · ${d.event.location}`}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold tabular-nums">{formatMoney(dealValue(d), d.event.currency)}</p>
                  <Badge className={SPONSORSHIP_STYLES[d.status]}>{SPONSORSHIP_LABELS[d.status]}</Badge>
                </div>
              </header>

              {!closed && (
                <ol className="grid grid-cols-4 gap-2 px-6 pt-5 text-xs">
                  {STEPS.map((s, i) => (
                    <li key={s}>
                      <div className={cx("h-1 rounded-full", i <= stepIndex ? "bg-emerald-500" : "bg-neutral-200")} />
                      <p className={cx("mt-1.5", i <= stepIndex ? "font-medium text-ink" : "text-ink-soft")}>{SPONSORSHIP_LABELS[s]}</p>
                    </li>
                  ))}
                </ol>
              )}

              <div className="grid gap-6 px-6 py-5 md:grid-cols-3">
                <div>
                  <h3 className="mb-2 text-xs font-medium text-ink-soft">Package</h3>
                  <ul className="space-y-1 text-sm">
                    {d.items.map((i) => <li key={i.id} className="flex justify-between gap-2"><span>{i.name}</span><span className="tabular-nums text-ink-soft">{formatMoney(i.price, d.event.currency)}</span></li>)}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-medium text-ink-soft">Your requirements</h3>
                  {d.requirements.length || d.requirementsNote ? (
                    <p className="text-sm">{[...d.requirements.map(sponsorRequirementLabel), d.requirementsNote].filter(Boolean).join(" · ")}</p>
                  ) : (
                    <p className="text-sm text-ink-soft">None</p>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-medium text-ink-soft">
                    Deliverables {deliverables.length > 0 && `(${deliverables.filter((x) => d.completedDeliverables.includes(x)).length}/${deliverables.length})`}
                  </h3>
                  {deliverables.length ? (
                    <DeliverableChecklist sponsorshipId={d.id} items={deliverables} completed={d.completedDeliverables} />
                  ) : (
                    <p className="text-sm text-ink-soft">Nothing to deliver.</p>
                  )}
                </div>
              </div>
              {d.status === "APPLIED" && (
                <footer className="flex justify-end border-t border-line px-6 py-3">
                  <ActionButton action={cancelSponsorship.bind(null, d.id)} variant="ghost" confirmText="Cancel this sponsorship request?">Cancel request</ActionButton>
                </footer>
              )}
            </article>
          );
        })
      )}
    </div>
  );
}
