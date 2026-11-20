import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge, Skeleton } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/dal";

export const metadata: Metadata = { title: "Audit log · Admin" };

export default function AuditPage() {
  return (
    <Suspense fallback={<Skeleton rows={5} />}>
      <Audit />
    </Suspense>
  );
}

async function Audit() {
  await requireAdmin();
  const entries = await prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { actor: { select: { id: true, name: true } } } });
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="min-w-full text-sm">
        <thead className="border-b border-line text-left text-xs text-ink-soft">
          <tr><th className="px-5 py-3 font-medium">When (UTC)</th><th className="px-5 py-3 font-medium">Admin</th><th className="px-5 py-3 font-medium">Action</th><th className="px-5 py-3 font-medium">Target</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {entries.map((a) => (
            <tr key={a.id}>
              <td className="whitespace-nowrap px-5 py-2.5 text-xs text-ink-soft">{a.createdAt.toISOString().replace("T", " ").slice(0, 16)}</td>
              <td className="px-5 py-2.5">{a.actor?.name ?? "Deleted user"}</td>
              <td className="px-5 py-2.5"><Badge>{a.action}</Badge></td>
              <td className="px-5 py-2.5 text-ink-soft">
                {a.targetType === "user" ? <Link href={`/admin/users/${a.targetId}`} className="underline">{a.summary || a.targetId}</Link> : a.summary || a.targetId}
              </td>
            </tr>
          ))}
          {entries.length === 0 && <tr><td colSpan={4} className="px-5 py-6 text-center text-ink-soft">No admin actions yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
