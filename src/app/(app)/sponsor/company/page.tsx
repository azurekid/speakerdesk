import type { Metadata } from "next";
import { Suspense } from "react";
import { CompanyForm } from "@/components/sponsor/company-form";
import { PageHeader, Skeleton } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";

export const metadata: Metadata = { title: "Company profile" };

type Props = PageProps<"/sponsor/company">;

export default function CompanyPage(props: Props) {
  return (
    <>
      <PageHeader eyebrow="Sponsor" title="Company profile" description="Organizers see this with every sponsorship request. Your logo appears on event pages once a deal is confirmed." />
      <Suspense fallback={<Skeleton rows={3} />}>
        <Company searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Company({ searchParams }: { searchParams: Props["searchParams"] }) {
  const user = await requireUser();
  const { next } = await searchParams;
  const org = await prisma.sponsorOrg.findUnique({ where: { ownerId: user.id } });
  return (
    <CompanyForm
      next={typeof next === "string" && next.startsWith("/sponsor/") ? next : undefined}
      values={{
        name: org?.name ?? "", website: org?.website ?? "", logoUrl: org?.logoUrl ?? "", description: org?.description ?? "",
        contactName: org?.contactName ?? user.name, contactEmail: org?.contactEmail ?? user.email,
      }}
    />
  );
}
