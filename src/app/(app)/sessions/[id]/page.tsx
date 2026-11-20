import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CopyPanel } from "@/components/copy-panel";
import { ActionButton, CopyButton } from "@/components/form-controls";
import { Clock, Gauge, Globe, Layers } from "lucide-react";
import { Badge, ButtonLink, buttonClass, Card, cx, Eyebrow, ExternalLink, FORMAT_COLORS, formatDate, Skeleton, StatusBadge, TagList } from "@/components/ui";
import { setTalkPublished } from "@/lib/actions/speaker-public";
import { deleteTalk, duplicateTalk, setTalkArchived } from "@/lib/actions/talks";
import { prisma } from "@/lib/db";
import { getOrCreateProfile, requireUser } from "@/lib/dal";
import { FORMAT_LABELS, LEVEL_LABELS, PLATFORM_LABELS } from "@/lib/domain";
import { takeawaysAsText } from "@/lib/platforms";

export const metadata: Metadata = { title: "Session" };

export default function SessionPage(props: PageProps<"/sessions/[id]">) {
  return (
    <Suspense fallback={<Skeleton rows={6} />}>
      <SessionDetail params={props.params} />
    </Suspense>
  );
}

function Section({ title, text, children }: { title: string; text?: string; children?: React.ReactNode }) {
  if (!text && !children) return null;
  return (
    <Card title={title} actions={text ? <CopyButton text={text} /> : undefined}>
      {children ?? <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">{text}</p>}
    </Card>
  );
}

async function SessionDetail({ params }: { params: PageProps<"/sessions/[id]">["params"] }) {
  const user = await requireUser();
  const { id } = await params;
  const [talk, profile] = await Promise.all([
    prisma.talk.findFirst({
      where: { id, userId: user.id },
      include: { submissions: { orderBy: [{ eventStart: "desc" }, { createdAt: "desc" }] } },
    }),
    getOrCreateProfile(user),
  ]);
  if (!talk) notFound();

  const accepted = talk.submissions.filter((s) => s.status === "ACCEPTED");

  return (
    <>
      <header className="mb-8 border-b border-line pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cx("h-4 w-1 rounded-full", FORMAT_COLORS[talk.format].stripe)} />
          <Eyebrow>{[FORMAT_LABELS[talk.format], talk.primaryTrack].filter(Boolean).join(" · ")}</Eyebrow>
          {talk.archived && <Badge className="bg-amber-50 text-amber-800 ring-amber-200">Archived</Badge>}
          {talk.published && <Badge className="bg-emerald-50 text-emerald-800 ring-emerald-200">On your public page</Badge>}
        </div>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight">{talk.title}</h1>
        {talk.subtitle && <p className="mt-2 text-lg text-ink-soft">{talk.subtitle}</p>}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-1.5"><Clock className="size-4" strokeWidth={1.75} />{talk.durationMinutes} minutes</span>
          <span className="inline-flex items-center gap-1.5"><Gauge className="size-4" strokeWidth={1.75} />{LEVEL_LABELS[talk.level]}</span>
          {talk.language && <span className="inline-flex items-center gap-1.5"><Globe className="size-4" strokeWidth={1.75} />{talk.language.toUpperCase()}</span>}
          <span className="inline-flex items-center gap-1.5"><Layers className="size-4" strokeWidth={1.75} />Given {accepted.length} time{accepted.length === 1 ? "" : "s"}</span>
        </div>
        {talk.tags.length > 0 && <div className="mt-3"><TagList tags={talk.tags} /></div>}
        <div className="mt-6 flex flex-wrap gap-2">
          <ButtonLink href={`/sessions/${talk.id}/edit`}>Edit</ButtonLink>
          <ActionButton action={setTalkPublished.bind(null, talk.id, !talk.published)}>{talk.published ? "Unpublish" : "Publish to speaker page"}</ActionButton>
          <ActionButton action={duplicateTalk.bind(null, talk.id)}>Duplicate</ActionButton>
          <a href={`/api/sessions/${talk.id}/markdown`} className={buttonClass("secondary")}>Markdown</a>
          <ActionButton action={setTalkArchived.bind(null, talk.id, !talk.archived)}>{talk.archived ? "Unarchive" : "Archive"}</ActionButton>
          <ActionButton action={deleteTalk.bind(null, talk.id)} variant="danger" confirmText="Delete this session? Submissions stay in your tracker but lose the link.">Delete</ActionButton>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <Section title="Short pitch" text={talk.abstractShort} />
          <Section title="Master abstract" text={talk.abstractLong} />
          {talk.takeaways.length > 0 && (
            <Section title="Key takeaways" text={takeawaysAsText(talk.takeaways)}>
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
                {talk.takeaways.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </Section>
          )}
          <Section title="Outline" text={talk.outline} />
          {(talk.equipmentNeeds || talk.organizerNotes || talk.slidesUrl || talk.videoUrl || talk.coSpeakers) && (
            <Card title="For organizers">
              <dl className="grid gap-3 text-sm sm:grid-cols-[140px_1fr] [overflow-wrap:anywhere]">
                {talk.coSpeakers && <><dt className="text-ink-soft">Co-speakers</dt><dd>{talk.coSpeakers}</dd></>}
                {talk.slidesUrl && <><dt className="text-ink-soft">Slides</dt><dd><ExternalLink href={talk.slidesUrl}>{talk.slidesUrl}</ExternalLink></dd></>}
                {talk.videoUrl && <><dt className="text-ink-soft">Recording</dt><dd><ExternalLink href={talk.videoUrl}>{talk.videoUrl}</ExternalLink></dd></>}
                {talk.equipmentNeeds && <><dt className="text-ink-soft">Equipment</dt><dd className="whitespace-pre-wrap">{talk.equipmentNeeds}</dd></>}
                {talk.organizerNotes && <><dt className="text-ink-soft">Notes</dt><dd className="whitespace-pre-wrap">{talk.organizerNotes}</dd></>}
              </dl>
            </Card>
          )}

          <Card
            title="Submissions"
            description={`${talk.submissions.length} tracked · ${accepted.length} accepted`}
            actions={<ButtonLink href={`/submissions/new?talkId=${talk.id}`} variant="secondary" size="sm">Track submission</ButtonLink>}
          >
            {talk.submissions.length === 0 ? (
              <p className="text-sm text-ink-soft">Not submitted anywhere yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {talk.submissions.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/submissions/${s.id}/edit`} className="text-sm font-medium text-ink hover:underline">{s.eventName}</Link>
                      <p className="text-xs text-ink-soft">
                        {PLATFORM_LABELS[s.platform]} · {s.eventStart ? formatDate(s.eventStart) : s.cfpDeadline ? `CfP closes ${formatDate(s.cfpDeadline)}` : "No date"}
                        {s.recordingUrl && <> · <ExternalLink href={s.recordingUrl}>recording</ExternalLink></>}
                      </p>
                    </div>
                    <StatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <Card title="Copy for a CfP" description="Paste-ready fields with platform limits.">
            <CopyPanel
              source={{
                title: talk.title,
                abstractShort: talk.abstractShort,
                abstractLong: talk.abstractLong,
                takeaways: talk.takeaways,
                bioShort: profile.bioShort,
                bioMedium: profile.bioMedium,
                bioLong: profile.bioLong,
                tagline: profile.tagline,
                headshotSquareUrl: profile.headshotSquareUrl,
              }}
            />
          </Card>
        </aside>
      </div>
    </>
  );
}
