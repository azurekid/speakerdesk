import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge, cx, Skeleton } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/dal";

export const metadata: Metadata = { title: "Email outbox · Admin" };

type Props = PageProps<"/admin/outbox">;

export default function OutboxPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={5} />}>
      <Outbox searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Outbox({ searchParams }: { searchParams: Props["searchParams"] }) {
  await requireAdmin();
  const { to } = await searchParams;
  const emails = await prisma.outboundEmail.findMany({
    where: typeof to === "string" && to ? { to: { contains: to, mode: "insensitive" } } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <div className="space-y-4">
      <form action="/admin/outbox" className="max-w-sm">
        <input name="to" defaultValue={typeof to === "string" ? to : ""} placeholder="Filter by recipient…" className="control" />
      </form>
      <ul className="space-y-3">
        {emails.map((m) => (
          <li key={m.id} className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm"><span className="font-medium">{m.subject}</span> <span className="text-ink-soft">→ {m.to}</span></p>
              <div className="flex items-center gap-2">
                <Badge>{m.kind}</Badge>
                <Badge className={cx(m.status === "SENT" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : m.status === "FAILED" ? "bg-rose-50 text-rose-800 ring-rose-200" : "bg-neutral-50 text-ink-soft ring-line")}>{m.status.toLowerCase()}</Badge>
                <span className="text-xs text-ink-soft">{m.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC</span>
              </div>
            </div>
            <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 font-mono text-xs text-ink-soft">{m.text}</pre>
            {m.error && <p className="mt-2 text-xs text-rose-700">{m.error}</p>}
          </li>
        ))}
        {emails.length === 0 && <p className="text-sm text-ink-soft">No emails yet.</p>}
      </ul>
    </div>
  );
}
