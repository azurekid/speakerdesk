import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StatusSelect } from "@/components/submission-form";
import { ButtonLink, cx, EmptyState, ExternalLink, formatDate, PageHeader, Skeleton } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { PLATFORM_LABELS, STATUS_LABELS, SUBMISSION_STATUSES, type SubmissionStatus } from "@/lib/domain";

export const metadata: Metadata = { title: "Submissions" };

export default function SubmissionsPage(props: PageProps<"/submissions">) {
  return (
    <>
      <PageHeader
        eyebrow="On tour"
        title="Submissions"
        description="Every CfP you've entered and where it stands."
        actions={<ButtonLink href="/submissions/new">Track submission</ButtonLink>}
      />
      <Suspense fallback={<Skeleton rows={4} />}>
        <SubmissionTable searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function SubmissionTable({ searchParams }: { searchParams: PageProps<"/submissions">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const status = SUBMISSION_STATUSES.includes(sp.status as SubmissionStatus) ? (sp.status as SubmissionStatus) : undefined;

  const [submissions, counts] = await Promise.all([
    prisma.submission.findMany({
      where: { userId: user.id, ...(status ? { status } : {}) },
      include: { talk: { select: { id: true, title: true } } },
      orderBy: [{ cfpDeadline: { sort: "desc", nulls: "last" } }, { eventStart: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    }),
    prisma.submission.groupBy({ by: ["status"], where: { userId: user.id }, _count: true }),
  ]);
  const countOf = (s: SubmissionStatus) => counts.find((c) => c.status === s)?._count ?? 0;
  const total = counts.reduce((n, c) => n + c._count, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-lg bg-surface p-1 text-sm ring-1 ring-line">
        <Link href="/submissions" className={cx("rounded-lg px-3 py-1", !status ? "bg-ink text-paper" : "text-ink-soft hover:bg-neutral-100")}>All <span className="opacity-60">{total}</span></Link>
        {SUBMISSION_STATUSES.map((s) => (
          <Link key={s} href={`/submissions?status=${s}`} className={cx("rounded-lg px-3 py-1", status === s ? "bg-ink text-paper" : "text-ink-soft hover:bg-neutral-100")}>
            {STATUS_LABELS[s]} <span className="opacity-60">{countOf(s)}</span>
          </Link>
        ))}
      </div>

      {submissions.length === 0 ? (
        <EmptyState title={status ? `No ${STATUS_LABELS[status].toLowerCase()} submissions` : "No submissions tracked yet"} action={!status && <ButtonLink href="/submissions/new">Track your first CfP</ButtonLink>}>
          {!status && "Log the CfPs you're planning or have entered to keep deadlines and decisions in view."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-surface  ring-1 ring-line">
          <table className="stack-table min-w-full divide-y divide-line text-sm">
            <thead className="bg-neutral-50 text-left text-[11px] font-semibold text-ink-soft">
              <tr>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">CfP deadline</th>
                <th className="px-4 py-3">Event date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {submissions.map((s) => (
                <tr key={s.id} className="align-top transition hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link href={`/submissions/${s.id}/edit`} className="font-medium text-ink hover:underline">{s.eventName}</Link>
                    <p className="text-xs text-ink-soft">
                      {PLATFORM_LABELS[s.platform]}
                      {s.location && ` · ${s.location}`}
                      {s.cfpUrl && <> · <ExternalLink href={s.cfpUrl}>CfP</ExternalLink></>}
                    </p>
                  </td>
                  <td data-label="Session" className="px-4 py-3">
                    {s.talk ? <Link href={`/sessions/${s.talk.id}`} className="text-ink hover:underline">{s.talk.title}</Link> : <span className="text-neutral-400">—</span>}
                  </td>
                  <td data-label="CfP deadline" className="whitespace-nowrap px-4 py-3 text-ink-soft">{formatDate(s.cfpDeadline)}</td>
                  <td data-label="Event date" className="whitespace-nowrap px-4 py-3 text-ink-soft">{formatDate(s.eventStart)}</td>
                  <td data-label="Status" className="px-4 py-3"><StatusSelect key={`${s.id}-${s.status}`} id={s.id} status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
