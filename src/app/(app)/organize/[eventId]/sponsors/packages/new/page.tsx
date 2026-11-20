import type { Metadata } from "next";
import { Suspense } from "react";
import { EMPTY_PACKAGE, PackageForm } from "@/components/organizer/sponsorship-controls";
import { Skeleton } from "@/components/ui";
import { createPackage } from "@/lib/actions/sponsorship";
import { requireEventAccess } from "@/lib/organizer";

export const metadata: Metadata = { title: "New sponsor package" };

type Props = PageProps<"/organize/[eventId]/sponsors/packages/new">;

export default function NewPackagePage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <NewPackage params={props.params} />
    </Suspense>
  );
}

async function NewPackage({ params }: { params: Props["params"] }) {
  const { eventId } = await params;
  const { event } = await requireEventAccess(eventId, "ORGANIZER");
  return <PackageForm values={EMPTY_PACKAGE} action={createPackage.bind(null, eventId)} cancelHref={`/organize/${eventId}/sponsors/packages`} currency={event.currency} />;
}
