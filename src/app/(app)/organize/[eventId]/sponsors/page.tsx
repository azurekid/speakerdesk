import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BudgetBar } from "@/components/budget-bar";
import { ActionButton, CopyButton } from "@/components/form-controls";
import { BudgetForm, DealStatusSelect } from "@/components/organizer/sponsorship-controls";
import { Badge, ButtonLink, Card, EmptyState, formatDate, Skeleton } from "@/components/ui";
import { setSponsorshipOpen } from "@/lib/actions/sponsorship";
import { dealValue, summarizeBudget } from "@/lib/budget";
import { formatMoney } from "@/lib/domain";
import { appUrl, requireEventAccess } from "@/lib/organizer";
import { canManage } from "@/lib/permissions";
import { sponsorRequirementLabel } from "@/lib/requirements";
import { getEventDeals, getPackages } from "@/lib/sponsor-queries";

export const metadata: Metadata = { title: "Sponsors & budget" };

type Props = PageProps<"/organize/[eventId]/sponsors">;

export default function SponsorsPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <Sponsors params={props.params} />
    </Suspense>
  );
}

async function Sponsors({ params }: { params: Props["params"] }) {
  const { eventId } = await params;
  const { event, role } = await requireEventAccess(eventId, "ORGANIZER");
  const [deals, packages] = await Promise.all([getEventDeals(eventId), getPackages(eventId)]);
  const budget = summarizeBudget(event.budgetTarget, event.otherIncome, deals);
  const owner = canManage(role);
  const prospectusUrl = `${appUrl()}/sponsor/${event.slug}`;
  const open = deals.filter((d) => d.status === "APPLIED");
  const rest = deals.filter((d) => d.status !== "APPLIED");

  return (
    <div className="space-y-8">
      <Card title="Budget">
        <BudgetBar b={budget} currency={event.currency} />
        {budget.target === null && <p className="mt-4 text-sm text-ink-soft">Set a budget target below to track how close you are.</p>}
      </Card>

      <Card
        title="Sponsor prospectus"
        description={event.sponsorshipOpen ? "Sponsors can find this event and request packages." : "Only your team can see your packages until you publish."}
        actions={<ButtonLink href={`/organize/${eventId}/sponsors/packages`} variant="secondary" size="sm">Manage packages ({packages.length})</ButtonLink>}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          {event.sponsorshipOpen ? (
            <div className="flex items-center gap-2">
              <code className="rounded-lg bg-neutral-100 px-2 py-1 text-xs">{prospectusUrl}</code>
              <CopyButton text={prospectusUrl} label="Copy link" />
            </div>
          ) : (
            <p className="text-sm text-ink-soft">{packages.filter((p) => p.published).length ? "Your packages are ready to go." : "Create at least one package before publishing."}</p>
          )}
          {owner && (
            <ActionButton action={setSponsorshipOpen.bind(null, eventId, !event.sponsorshipOpen)} variant={event.sponsorshipOpen ? "secondary" : "accent"}>
              {event.sponsorshipOpen ? "Close sponsorship" : "Publish prospectus"}
            </ActionButton>
          )}
        </div>
      </Card>

      <section>
        <h2 className="mb-3 text-xl font-semibold tracking-tight">Sponsor pipeline</h2>
        {deals.length === 0 ? (
          <EmptyState title="No sponsor requests yet" photo="/images/events/networking.jpg">
            Publish your prospectus and share the link with companies you&apos;d like to work with.
          </EmptyState>
        ) : (
          <div className="space-y-6">
            {open.length > 0 && <DealList title={`Waiting for you (${open.length})`} deals={open} currency={event.currency} owner={owner} />}
            {rest.length > 0 && <DealList title="All deals" deals={rest} currency={event.currency} owner={owner} />}
          </div>
        )}
      </section>

      {owner && (
        <Card title="Budget settings">
          <BudgetForm eventId={eventId} values={{ currency: event.currency, budgetTarget: event.budgetTarget, otherIncome: event.otherIncome, prospectusIntro: event.prospectusIntro }} />
        </Card>
      )}
    </div>
  );
}

type Deal = Awaited<ReturnType<typeof getEventDeals>>[number];

function DealList({ title, deals, currency, owner }: { title: string; deals: Deal[]; currency: string; owner: boolean }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-ink-soft">{title}</h3>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {deals.map((d) => {
          const deliverables = [...new Set(d.items.flatMap((i) => i.deliverables))];
          const done = deliverables.filter((x) => d.completedDeliverables.includes(x)).length;
          return (
            <li key={d.id} className="grid gap-4 p-5 md:grid-cols-[1fr_auto]">
              <div className="flex min-w-0 gap-4">
                {d.sponsorOrg.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- sponsor-provided logo host
                  <img src={d.sponsorOrg.logoUrl} alt="" className="size-12 shrink-0 rounded-xl border border-line object-contain p-1" />
                ) : (
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-neutral-100 text-lg font-semibold">{d.sponsorOrg.name[0]}</span>
                )}
                <div className="min-w-0 space-y-2">
                  <div>
                    <p className="font-semibold">{d.sponsorOrg.name}</p>
                    <p className="text-xs text-ink-soft">
                      {d.sponsorOrg.contactName || "No contact"}{d.sponsorOrg.contactEmail && <> · <Link href={`mailto:${d.sponsorOrg.contactEmail}`} className="underline">{d.sponsorOrg.contactEmail}</Link></>} · requested {formatDate(d.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {d.items.map((i) => <Badge key={i.id} className={i.kind === "TIER" ? "bg-ink text-paper ring-ink" : undefined}>{i.name} · {formatMoney(i.price, currency)}</Badge>)}
                  </div>
                  {d.requirements.length > 0 && (
                    <p className="text-xs text-ink-soft"><span className="font-medium text-ink">Needs:</span> {d.requirements.map(sponsorRequirementLabel).join(", ")}</p>
                  )}
                  {d.requirementsNote && <p className="text-xs text-ink-soft">{d.requirementsNote}</p>}
                  {d.message && <p className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-ink-soft">“{d.message}”</p>}
                  {deliverables.length > 0 && <p className="text-xs text-ink-soft">Deliverables: {done}/{deliverables.length} done</p>}
                </div>
              </div>
              <div className="flex items-start gap-3 md:flex-col md:items-end">
                <p className="text-lg font-semibold tabular-nums">{formatMoney(dealValue(d), currency)}</p>
                {owner ? <DealStatusSelect key={`${d.id}-${d.status}`} id={d.id} status={d.status} /> : <Badge>{d.status}</Badge>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
