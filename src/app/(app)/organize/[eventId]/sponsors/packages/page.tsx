import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/form-controls";
import { Badge, ButtonLink, cx, EmptyState, Skeleton } from "@/components/ui";
import { deletePackage } from "@/lib/actions/sponsorship";
import { formatMoney } from "@/lib/domain";
import { requireEventAccess } from "@/lib/organizer";
import { canManage } from "@/lib/permissions";
import { getPackages, type PackageWithAvailability } from "@/lib/sponsor-queries";

export const metadata: Metadata = { title: "Sponsor packages" };

type Props = PageProps<"/organize/[eventId]/sponsors/packages">;

export default function PackagesPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <Packages params={props.params} />
    </Suspense>
  );
}

async function Packages({ params }: { params: Props["params"] }) {
  const { eventId } = await params;
  const { event, role } = await requireEventAccess(eventId, "ORGANIZER");
  const packages = await getPackages(eventId);
  const tiers = packages.filter((p) => p.kind === "TIER");
  const addons = packages.filter((p) => p.kind === "ADDON");
  const owner = canManage(role);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/organize/${eventId}/sponsors`} className="text-sm text-ink-soft hover:text-ink">← Sponsors & budget</Link>
        {owner && <ButtonLink href={`/organize/${eventId}/sponsors/packages/new`}>New package</ButtonLink>}
      </div>
      {packages.length === 0 ? (
        <EmptyState title="Create your sponsor packages" photo="/images/events/networking.jpg" action={owner && <ButtonLink href={`/organize/${eventId}/sponsors/packages/new`}>Create the first package</ButtonLink>}>
          Start with two or three tiers (for example Gold, Silver and Community) and a few add-ons like the coffee bar or the after-party.
        </EmptyState>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-xl font-semibold tracking-tight">Tiers</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {tiers.map((p) => <PackageCard key={p.id} p={p} eventId={eventId} currency={event.currency} owner={owner} />)}
            </div>
          </section>
          {addons.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-semibold tracking-tight">Add-ons</h2>
              <div className="grid gap-4 md:grid-cols-3">
                {addons.map((p) => <PackageCard key={p.id} p={p} eventId={eventId} currency={event.currency} owner={owner} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function PackageCard({ p, eventId, currency, owner }: { p: PackageWithAvailability; eventId: string; currency: string; owner: boolean }) {
  return (
    <article className={cx("flex flex-col rounded-2xl border bg-surface p-5", p.featured ? "border-ink" : "border-line", !p.published && "opacity-60")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{p.name}</h3>
        <div className="flex gap-1">
          {p.featured && <Badge className="bg-brand-50 text-brand-700 ring-brand-200">Most popular</Badge>}
          {!p.published && <Badge>Hidden</Badge>}
        </div>
      </div>
      {p.tagline && <p className="text-sm text-ink-soft">{p.tagline}</p>}
      <p className="mt-3 text-2xl font-semibold tabular-nums">{formatMoney(p.price, currency)}</p>
      <p className="text-xs text-ink-soft">{p.quantity === null ? `${p.taken} taken · unlimited` : `${p.taken} of ${p.quantity} taken`}</p>
      <ul className="mt-4 flex-1 space-y-1.5 text-sm">
        {p.benefits.map((b) => <li key={b} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{b}</li>)}
      </ul>
      {owner && (
        <div className="mt-5 flex gap-2 border-t border-line pt-4">
          <ButtonLink href={`/organize/${eventId}/sponsors/packages/${p.id}`} variant="secondary" size="sm">Edit</ButtonLink>
          <ActionButton action={deletePackage.bind(null, p.id)} variant="ghost" confirmText={p.taken ? "This package has been sold — it will be hidden instead of deleted. Continue?" : `Delete ${p.name}?`}>
            {p.taken ? "Hide" : "Delete"}
          </ActionButton>
        </div>
      )}
    </article>
  );
}
