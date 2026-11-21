import { Download, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge, cx, Skeleton } from "@/components/ui";
import { AUDIT_RETENTION_DAYS } from "@/lib/audit";
import { AUDIT_CATEGORIES as CATEGORIES, auditWhere } from "@/lib/audit-query";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/dal";

export const metadata: Metadata = { title: "Audit log · Admin" };

type Props = PageProps<"/admin/audit">;

const PAGE = 100;

export default function AuditPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={5} />}>
      <Audit searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Audit({ searchParams }: { searchParams: Props["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);
  const where = auditWhere(sp);
  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { actor: { select: { id: true, name: true } } } }),
    prisma.auditLog.count({ where }),
  ]);
  const category = typeof sp.category === "string" && sp.category in CATEGORIES ? sp.category : "all";
  const qs = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (typeof v === "string" && v) next.set(k, v);
    return `?${next}`;
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        Sign-ins, account changes, every data change and every admin action. Entries are kept for {AUDIT_RETENTION_DAYS} days. Changed field names are recorded, never their values.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(CATEGORIES).map(([k, label]) => (
          <Link key={k} href={qs({ category: k === "all" ? undefined : k, page: undefined })} className={cx("rounded-full px-3 py-1 text-sm ring-1 ring-inset ring-line", category === k ? "bg-ink text-paper" : "text-ink-soft hover:text-ink")}>
            {label}
          </Link>
        ))}
        <Link href={qs({ outcome: sp.outcome === "failure" ? undefined : "failure", page: undefined })} className={cx("rounded-full px-3 py-1 text-sm ring-1 ring-inset", sp.outcome === "failure" ? "bg-rose-700 text-white ring-rose-700" : "text-rose-700 ring-rose-200")}>
          Failures only
        </Link>
        <form className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          {Object.entries(sp).filter(([k, v]) => k !== "q" && k !== "page" && typeof v === "string").map(([k, v]) => <input key={k} type="hidden" name={k} value={v as string} />)}
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-ink-soft" />
            <input name="q" defaultValue={typeof sp.q === "string" ? sp.q : ""} placeholder="Action, email, IP or ID" className="control w-full pl-8" />
          </label>
          <a href={`/api/admin/audit-export${qs({ page: undefined })}`} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-ink-soft ring-1 ring-inset ring-line hover:text-ink">
            <Download className="size-4" />CSV
          </a>
        </form>
      </div>
      {typeof sp.user === "string" && sp.user && (
        <p className="text-sm">Showing activity by or about user <Link href={`/admin/users/${sp.user}`} className="underline">{sp.user}</Link> · <Link href={qs({ user: undefined, page: undefined })} className="text-ink-soft underline">clear</Link></p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="stack-table min-w-full text-sm">
          <thead className="border-b border-line text-left text-xs text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">When (UTC)</th>
              <th className="px-4 py-3 font-medium">Who</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Target</th>
              <th className="px-4 py-3 font-medium">Details</th>
              <th className="px-4 py-3 font-medium">From</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {entries.map((a) => (
              <tr key={a.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-soft">{a.createdAt.toISOString().replace("T", " ").slice(0, 19)}</td>
                <td data-label="Who" className="px-4 py-2.5">
                  {a.actor ? <Link href={`/admin/users/${a.actor.id}`} className="underline">{a.actor.name}</Link> : a.actorEmail || <span className="text-ink-soft">-</span>}
                  {a.impersonatorId && <Badge className="ml-1 bg-amber-50 text-amber-800 ring-amber-200">via admin</Badge>}
                </td>
                <td data-label="Action" className="px-4 py-2.5"><Badge className={a.outcome === "failure" ? "bg-rose-50 text-rose-800 ring-rose-200" : undefined}>{a.action}</Badge></td>
                <td data-label="Target" className="break-all px-4 py-2.5 text-ink-soft">
                  {a.targetType === "user" && a.targetId ? <Link href={`/admin/users/${a.targetId}`} className="underline">{a.summary || a.targetId}</Link> : <>{a.targetType} <span className="font-mono text-xs">{a.targetId}</span></>}
                </td>
                <td className="max-w-xs px-4 py-2.5 text-xs text-ink-soft">
                  {a.targetType !== "user" && a.summary && <div>{a.summary}</div>}
                  {a.metadata != null && <code className="break-all">{JSON.stringify(a.metadata)}</code>}
                </td>
                <td data-label="From" className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-ink-soft"><span>{a.ipAddress || "-"}</span></td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={6} className="px-5 py-6 text-center text-ink-soft">No entries match.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-ink-soft">
        <span>{total.toLocaleString("en")} entries</span>
        <span className="flex gap-3">
          {page > 1 && <Link href={qs({ page: String(page - 1) })} className="underline">← Newer</Link>}
          {page * PAGE < total && <Link href={qs({ page: String(page + 1) })} className="underline">Older →</Link>}
        </span>
      </div>
    </div>
  );
}
