import type { Metadata } from "next";
import { ImportTabs } from "@/components/importers";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Import" };

export default function ImportPage() {
  return (
    <>
      <PageHeader
        eyebrow="Load-in"
        title="Import"
        description="Bring in sessions and history from other platforms. Imports never overwrite what you already have."
      />
      <ImportTabs />
    </>
  );
}
