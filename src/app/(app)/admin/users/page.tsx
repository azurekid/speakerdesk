import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { Badge, cx, formatDate, Skeleton } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/dal";

export const metadata: Metadata = { title: "Users · Admin" };

type Props = PageProps<"/admin/users">;

const FILTERS = { all: "All", admins: "Admins", banned: "Banned", unverified: "Unverified", onboarding: "Not onboarded" } as const;

export default function UsersPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={6} />}>
      <Users searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Users({ searchParams }: { searchParams: Props["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const filter = (typeof sp.filter === "string" && sp.filter in FILTERS ? sp.filter : "all") as keyof typeof FILTERS;
  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
    ...(filter === "admins" ? { role: "admin" } : filter === "banned" ? { banned: true } : filter === "unverified" ? { emailVerified: false } : filter === "onboarding" ? { onboardedAt: null } : {}),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { sessions: { select: { updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 1 }, _count: { select: { eventMemberships: true, talks: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  const href = (next: Record<string, string>) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), ...(filter !== "all" ? { filter } : {}), ...next })}`;

  return (
    <div className="space-y-4">
      {sp.deleted === "1" && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Account deleted.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <form action="/admin/users" className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input name="q" defaultValue={q} placeholder="Search name or email…" className="control pl-9" />
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        </form>
        <div className="flex flex-wrap gap-1">
          {Object.entries(FILTERS).map(([k, label]) => (
            <Link key={k} href={href({ filter: k })} className={cx("rounded-lg px-3 py-1 text-sm", filter === k ? "bg-ink text-paper" : "text-ink-soft hover:bg-neutral-100")}>{label}</Link>
          ))}
        </div>
        <span className="ml-auto text-sm text-ink-soft">{total} user{total === 1 ? "" : "s"}</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="stack-table min-w-full text-sm">
          <thead className="border-b border-line text-left text-xs text-ink-soft">
            <tr>
              <th className="px-5 py-3 font-medium">User</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Main role</th>
              <th className="px-5 py-3 font-medium">Activity</th>
              <th className="px-5 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-neutral-50">
                <td className="px-5 py-3">
                  <Link href={`/admin/users/${u.id}`} className="font-medium hover:text-brand-700">{u.name}</Link>
                  <p className="text-xs text-ink-soft">{u.email}</p>
                </td>
                <td data-label="Status" className="px-5 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.role === "admin" && <Badge className="bg-ink text-paper ring-ink">Admin</Badge>}
                    {u.banned && <Badge className="bg-rose-50 text-rose-800 ring-rose-200">Banned</Badge>}
                    {!u.emailVerified && <Badge className="bg-amber-50 text-amber-800 ring-amber-200">Unverified</Badge>}
                    {!u.onboardedAt && <Badge>Onboarding</Badge>}
                  </div>
                </td>
                <td data-label="Main role" className="px-5 py-3 text-ink-soft">{{ SPEAKER: "Speaker", ORGANIZER: "Organizer", SPONSOR: "Sponsor" }[u.primaryRole]}</td>
                <td data-label="Activity" className="px-5 py-3 text-xs text-ink-soft">
                  {u._count.talks} talks · {u._count.eventMemberships} events<br />
                  {u.sessions[0] ? `Seen ${formatDate(u.sessions[0].updatedAt)}` : "Never signed in"}
                </td>
                <td data-label="Joined" className="px-5 py-3 text-xs text-ink-soft">{formatDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > users.length && <p className="text-xs text-ink-soft">Showing the newest {users.length}. Search to narrow down.</p>}
    </div>
  );
}
