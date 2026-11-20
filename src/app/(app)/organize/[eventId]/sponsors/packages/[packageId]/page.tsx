import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PackageForm } from "@/components/organizer/sponsorship-controls";
import { Skeleton } from "@/components/ui";
import { updatePackage } from "@/lib/actions/sponsorship";
import { prisma } from "@/lib/db";
import { requireEventAccess } from "@/lib/organizer";

export const metadata: Metadata = { title: "Edit sponsor package" };

type Props = PageProps<"/organize/[eventId]/sponsors/packages/[packageId]">;

export default function EditPackagePage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <EditPackage params={props.params} />
    </Suspense>
  );
}

async function EditPackage({ params }: { params: Props["params"] }) {
  const { eventId, packageId } = await params;
  const { event } = await requireEventAccess(eventId, "ORGANIZER");
  const p = await prisma.sponsorPackage.findFirst({ where: { id: packageId, eventId } });
  if (!p) notFound();
  return (
    <PackageForm
      currency={event.currency}
      action={updatePackage.bind(null, p.id)}
      cancelHref={`/organize/${eventId}/sponsors/packages`}
      values={{ kind: p.kind, name: p.name, tagline: p.tagline, price: p.price, quantity: p.quantity, benefits: p.benefits, deliverables: p.deliverables, featured: p.featured, published: p.published }}
    />
  );
}
