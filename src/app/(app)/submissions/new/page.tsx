import type { Metadata } from "next";
import { Suspense } from "react";
import { SubmissionForm } from "@/components/submission-form";
import { PageHeader, Skeleton } from "@/components/ui";
import { createSubmission } from "@/lib/actions/submissions";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";

export const metadata: Metadata = { title: "Track submission" };

export default function NewSubmissionPage(props: PageProps<"/submissions/new">) {
  return (
    <>
      <PageHeader eyebrow="On tour" title="Track a submission" />
      <Suspense fallback={<Skeleton rows={4} />}>
        <NewSubmission searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function NewSubmission({ searchParams }: { searchParams: PageProps<"/submissions/new">["searchParams"] }) {
  const user = await requireUser();
  const { talkId } = await searchParams;
  const talks = await prisma.talk.findMany({ where: { userId: user.id, archived: false }, select: { id: true, title: true }, orderBy: { title: "asc" } });
  const preselected = typeof talkId === "string" && talks.some((t) => t.id === talkId) ? talkId : "";
  return (
    <SubmissionForm
      talks={talks}
      action={createSubmission}
      cancelHref={preselected ? `/sessions/${preselected}` : "/submissions"}
      values={{
        talkId: preselected, eventName: "", eventUrl: "", cfpUrl: "", platform: "SESSIONIZE", location: "", status: "DRAFT",
        cfpDeadline: "", eventStart: "", eventEnd: "", submittedAt: "", recordingUrl: "", notes: "",
        mvpTechnologyArea: "", targetAudience: "", microsoftEvent: false, inPersonAttendees: "", liveStreamViews: "", onDemandViews: "",
      }}
    />
  );
}
