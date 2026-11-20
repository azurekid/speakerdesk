import type { Metadata } from "next";
import { Suspense } from "react";
import { EMPTY_TALK, TalkForm } from "@/components/talk-form";
import { PageHeader, Skeleton } from "@/components/ui";
import { createTalk } from "@/lib/actions/talks";
import { requireUser } from "@/lib/dal";
import { getTagSuggestions } from "@/lib/queries";

export const metadata: Metadata = { title: "New session" };

export default function NewSessionPage() {
  return (
    <>
      <PageHeader eyebrow="The programme" title="New session" />
      <Suspense fallback={<Skeleton rows={6} />}>
        <NewSessionForm />
      </Suspense>
    </>
  );
}

async function NewSessionForm() {
  const user = await requireUser();
  return <TalkForm talk={EMPTY_TALK} action={createTalk} tagSuggestions={await getTagSuggestions(user.id)} cancelHref="/sessions" />;
}
