import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Clock, Gauge, Send, Trophy } from "lucide-react";
import { Badge, ButtonLink, cx, EmptyState, FORMAT_COLORS, FormatBadge, PageHeader, Skeleton, TagList } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { LEVEL_LABELS } from "@/lib/domain";
import { getTagSuggestions } from "@/lib/queries";

export const metadata: Metadata = { title: "Sessions" };

export default function SessionsPage(props: PageProps<"/sessions">) {
  return (
    <>
      <PageHeader
        eyebrow="The programme"
        title="Sessions"
        description="Your library of talks, workshops and panels."
        actions={<ButtonLink href="/sessions/new">New session</ButtonLink>}
      />
      <Suspense fallback={<Skeleton rows={4} />}>
        <SessionList searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function SessionList({ searchParams }: { searchParams: PageProps<"/sessions">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const tag = typeof sp.tag === "string" ? sp.tag : "";
  const archived = sp.archived === "1";

  const [talks, tags] = await Promise.all([
    prisma.talk.findMany({
      where: {
        userId: user.id,
        archived,
        ...(tag ? { tags: { has: tag } } : {}),
        ...(q
          ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { abstractLong: { contains: q, mode: "insensitive" } }, { abstractShort: { contains: q, mode: "insensitive" } }] }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { submissions: true } }, submissions: { where: { status: "ACCEPTED" }, select: { id: true } } },
    }),
    getTagSuggestions(user.id),
  ]);

  const filterHref = (next: { tag?: string; archived?: boolean }) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const t = next.tag ?? tag;
    if (t) params.set("tag", t);
    if (next.archived ?? archived) params.set("archived", "1");
    const s = params.toString();
    return s ? `/sessions?${s}` : "/sessions";
  };

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-center gap-2" action="/sessions">
        <input name="q" defaultValue={q} placeholder="Search titles and abstracts…" className="control max-w-sm" />
        {tag && <input type="hidden" name="tag" value={tag} />}
        {archived && <input type="hidden" name="archived" value="1" />}
        <button className="rounded-md bg-surface px-3 py-2 text-sm font-medium ring-1 ring-line hover:ring-ink/40">Search</button>
        <div className="ml-auto flex gap-1 text-sm">
          <Link href={filterHref({ archived: false })} className={cx("rounded px-3 py-1", !archived ? "bg-ink text-paper" : "text-ink-soft hover:bg-neutral-100")}>Active</Link>
          <Link href={filterHref({ archived: true })} className={cx("rounded px-3 py-1", archived ? "bg-ink text-paper" : "text-ink-soft hover:bg-neutral-100")}>Archived</Link>
        </div>
      </form>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tag && <Link href={filterHref({ tag: "" })} className="rounded bg-ink px-2.5 py-0.5 text-xs font-medium text-paper">× #{tag}</Link>}
          {tags.filter((t) => t !== tag).slice(0, 20).map((t) => (
            <Link key={t} href={filterHref({ tag: t })} className="rounded bg-surface px-2.5 py-0.5 text-xs text-ink-soft ring-1 ring-line hover:ring-ink/40">#{t}</Link>
          ))}
        </div>
      )}

      {talks.length === 0 ? (
        q || tag ? (
          <EmptyState title="No sessions match">Try a different search or tag.</EmptyState>
        ) : (
          <EmptyState
            title={archived ? "No archived sessions" : "No sessions yet"}
            photo="/images/events/speaker-screen.jpg"
            action={!archived && <div className="flex gap-2"><ButtonLink href="/sessions/new">Write your first session</ButtonLink><ButtonLink href="/import" variant="secondary">Import</ButtonLink></div>}
          >
            {!archived && "Add a talk once, then reuse its title, abstracts and takeaways for every CfP."}
          </EmptyState>
        )
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {talks.map((t) => (
            <li key={t.id}>
              <Link href={`/sessions/${t.id}`} className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface p-5 transition-colors hover:border-ink/30">
                <span className={cx("absolute inset-x-0 top-0 h-0.5", FORMAT_COLORS[t.format].stripe)} />
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5"><FormatBadge format={t.format} />{t.published && <Badge className="bg-emerald-50 text-emerald-800 ring-emerald-200">Public</Badge>}</span>
                  {t.primaryTrack && <span className="truncate text-[11px] text-ink-soft">{t.primaryTrack}</span>}
                </div>
                <h3 className="mt-3 font-display tracking-tight text-xl font-semibold leading-snug group-hover:text-brand-700">{t.title}</h3>
                {t.subtitle && <p className="text-sm text-ink-soft">{t.subtitle}</p>}
                {(t.abstractShort || t.abstractLong) && <p className="mt-2 line-clamp-2 text-sm text-ink-soft [overflow-wrap:anywhere]">{t.abstractShort || t.abstractLong}</p>}
                <div className="mb-4 mt-3"><TagList tags={t.tags.slice(0, 5)} /></div>
                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-ink-soft">
                  <span className="inline-flex items-center gap-1"><Clock className="size-3.5" strokeWidth={1.75} />{t.durationMinutes} min</span>
                  <span className="inline-flex items-center gap-1"><Gauge className="size-3.5" strokeWidth={1.75} />{LEVEL_LABELS[t.level]}</span>
                  <span className="inline-flex items-center gap-1"><Send className="size-3.5" strokeWidth={1.75} />{t._count.submissions} submitted</span>
                  {t.submissions.length > 0 && <span className="inline-flex items-center gap-1 font-medium text-emerald-800"><Trophy className="size-3.5" strokeWidth={1.75} />{t.submissions.length} accepted</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
