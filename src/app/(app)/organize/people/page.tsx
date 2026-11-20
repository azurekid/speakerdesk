import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { ROLE_LABELS, ROLE_STYLES } from "@/lib/permissions";

export const metadata: Metadata = { title: "People" };

export default function PeoplePage() {
  return (
    <>
      <PageHeader eyebrow="Organizer" title="People" description="Everyone on the teams of events you run, in one place. Manage roles per event from its Team tab." />
      <Suspense fallback={<Skeleton rows={4} />}>
        <People />
      </Suspense>
    </>
  );
}

async function People() {
  const user = await requireUser();
  const managed = await prisma.eventMember.findMany({ where: { userId: user.id, role: { in: ["OWNER", "ORGANIZER"] } }, select: { eventId: true } });
  const eventIds = managed.map((m) => m.eventId);
  if (!eventIds.length) {
    return <EmptyState title="No teams yet" photo="/images/events/panel.jpg">Once you own or co-organize an event, its team shows up here.</EmptyState>;
  }
  const [members, invites] = await Promise.all([
    prisma.eventMember.findMany({
      where: { eventId: { in: eventIds } },
      include: { user: { select: { id: true, name: true, email: true } }, event: { select: { id: true, name: true } } },
    }),
    prisma.eventInvite.findMany({ where: { eventId: { in: eventIds }, acceptedAt: null, expiresAt: { gt: new Date() } }, include: { event: { select: { id: true, name: true } } } }),
  ]);
  const people = new Map<string, { name: string; email: string; roles: typeof members }>();
  for (const m of members) {
    const p = people.get(m.userId) ?? { name: m.user.name, email: m.user.email, roles: [] };
    p.roles.push(m);
    people.set(m.userId, p);
  }
  const rows = [...people.entries()].sort((a, b) => b[1].roles.length - a[1].roles.length || a[1].name.localeCompare(b[1].name));

  return (
    <div className="space-y-8">
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="min-w-full text-sm">
          <thead className="border-b border-line text-left text-xs text-ink-soft">
            <tr>
              <th className="px-5 py-3 font-medium">Person</th>
              <th className="px-5 py-3 font-medium">Events &amp; roles</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(([id, p]) => (
              <tr key={id}>
                <td className="px-5 py-3">
                  <p className="font-medium">{p.name}{id === user.id && <span className="font-normal text-ink-soft"> (you)</span>}</p>
                  <p className="text-xs text-ink-soft">{p.email}</p>
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-2">
                    {p.roles.map((m) => (
                      <Link key={m.id} href={`/organize/${m.event.id}/team`} className="inline-flex items-center gap-1.5 rounded-full border border-line py-0.5 pl-3 pr-1 text-xs hover:border-neutral-400">
                        {m.event.name}
                        <Badge className={ROLE_STYLES[m.role]}>{ROLE_LABELS[m.role]}</Badge>
                      </Link>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {invites.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold tracking-tight">Pending invites</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="font-medium">{i.email}</span>
                <Link href={`/organize/${i.event.id}/team`} className="text-ink-soft hover:text-ink">{i.event.name} · {ROLE_LABELS[i.role]}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
