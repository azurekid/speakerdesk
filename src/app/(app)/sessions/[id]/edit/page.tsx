import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TalkForm } from "@/components/talk-form";
import { PageHeader, Skeleton } from "@/components/ui";
import { updateTalk } from "@/lib/actions/talks";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { getTagSuggestions } from "@/lib/queries";

export const metadata: Metadata = { title: "Edit session" };

export default function EditSessionPage(props: PageProps<"/sessions/[id]/edit">) {
  return (
    <>
      <PageHeader eyebrow="The programme" title="Edit session" />
      <Suspense fallback={<Skeleton rows={6} />}>
        <EditForm params={props.params} />
      </Suspense>
    </>
  );
}

async function EditForm({ params }: { params: PageProps<"/sessions/[id]/edit">["params"] }) {
  const user = await requireUser();
  const { id } = await params;
  const talk = await prisma.talk.findFirst({ where: { id, userId: user.id } });
  if (!talk) notFound();
  return <TalkForm talk={talk} action={updateTalk.bind(null, talk.id)} tagSuggestions={await getTagSuggestions(user.id)} cancelHref={`/sessions/${talk.id}`} />;
}
