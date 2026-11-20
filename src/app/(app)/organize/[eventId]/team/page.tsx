import { Check, Minus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionButton, CopyButton } from "@/components/form-controls";
import { InviteForm, RoleSelect } from "@/components/organizer/team-controls";
import { Badge, Card, cx, formatDate, Skeleton } from "@/components/ui";
import { removeMember, revokeInvite } from "@/lib/actions/team";
import { prisma } from "@/lib/db";
import { appUrl, requireEventAccess } from "@/lib/organizer";
import { assignableRoles, atLeast, canAdmin, canManage, EVENT_ROLES, PERMISSION_MATRIX, ROLE_LABELS, ROLE_STYLES } from "@/lib/permissions";
import { isOverdue, startOfToday } from "@/lib/runbook";
import { getRunbook } from "@/lib/runbook-queries";

export const metadata: Metadata = { title: "Team" };

type Props = PageProps<"/organize/[eventId]/team">;

export default function TeamPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <Team params={props.params} />
    </Suspense>
  );
}

function lastSeen(d: Date | undefined) {
  if (!d) return "Never";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 5) return "Active now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} days ago`;
}

async function Team({ params }: { params: Props["params"] }) {
  const { eventId } = await params;
  const { user, role } = await requireEventAccess(eventId, "VOLUNTEER");
  const [members, invites, { tasks }, reviewCounts] = await Promise.all([
    prisma.eventMember.findMany({
      where: { eventId },
      include: { user: { select: { id: true, name: true, email: true, image: true, sessions: { select: { updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 1 } } } },
      orderBy: { createdAt: "asc" },
    }),
    canManage(role) ? prisma.eventInvite.findMany({ where: { eventId, acceptedAt: null }, include: { invitedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
    getRunbook(eventId),
    prisma.review.groupBy({ by: ["reviewerId"], where: { proposal: { eventId } }, _count: true }),
  ]);
  const today = startOfToday();
  const owners = members.filter((m) => m.role === "OWNER").length;
  const sorted = [...members].sort((a, b) => EVENT_ROLES.indexOf(a.role) - EVENT_ROLES.indexOf(b.role));
  const now = new Date();

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {EVENT_ROLES.map((r) => (
          <div key={r} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs text-ink-soft">{ROLE_LABELS[r]}s</p>
            <p className="text-3xl font-semibold tabular-nums">{members.filter((m) => m.role === r).length}</p>
          </div>
        ))}
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs text-ink-soft">Pending invites</p>
          <p className="text-3xl font-semibold tabular-nums">{invites.filter((i) => i.expiresAt > now).length}</p>
        </div>
      </div>

      {canManage(role) && (
        <Card title="Invite people" description={canAdmin(role) ? "Add co-organizers, reviewers and volunteers." : "Co-organizers can invite reviewers and volunteers."}>
          <InviteForm eventId={eventId} roles={assignableRoles(role)} />
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-xl font-semibold tracking-tight">Members</h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="stack-table min-w-full text-sm">
            <thead className="border-b border-line text-left text-xs text-ink-soft">
              <tr>
                <th className="px-5 py-3 font-medium">Person</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Open tasks</th>
                <th className="px-5 py-3 font-medium">Reviews</th>
                <th className="px-5 py-3 font-medium">Last active</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sorted.map((m) => {
                const mine = tasks.filter((t) => t.assigneeId === m.userId && t.effectiveStatus !== "DONE");
                const late = mine.filter((t) => isOverdue({ status: t.effectiveStatus, dueDate: t.dueDate }, today)).length;
                const reviews = reviewCounts.find((r) => r.reviewerId === m.userId)?._count ?? 0;
                const self = m.userId === user.id;
                const lastOwner = m.role === "OWNER" && owners <= 1;
                const canRemove = !lastOwner && (self || canAdmin(role) || (canManage(role) && !canManage(m.role)));
                const initials = m.user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
                return (
                  <tr key={m.id} className="align-middle">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-xs font-semibold">{initials}</span>
                        <div className="min-w-0">
                          <p className="font-medium">{m.user.name}{self && <span className="font-normal text-ink-soft"> (you)</span>}</p>
                          <p className="truncate text-xs text-ink-soft">{m.title ? `${m.title} · ` : ""}{atLeast(role, "REVIEWER") ? m.user.email : ""}</p>
                        </div>
                      </div>
                    </td>
                    <td data-label="Role" className="px-5 py-3">
                      {canAdmin(role) && !lastOwner && !self ? (
                        <RoleSelect key={`${m.id}-${m.role}`} memberId={m.id} role={m.role} options={[...EVENT_ROLES]} />
                      ) : (
                        <Badge className={ROLE_STYLES[m.role]}>{ROLE_LABELS[m.role]}</Badge>
                      )}
                    </td>
                    <td data-label="Open tasks" className="px-5 py-3 tabular-nums">
                      {mine.length}{late > 0 && <span className="ml-2 text-xs font-medium text-rose-700">{late} overdue</span>}
                    </td>
                    <td data-label="Reviews" className="px-5 py-3 tabular-nums text-ink-soft">{atLeast(m.role, "REVIEWER") ? reviews : "—"}</td>
                    <td data-label="Last active" className="px-5 py-3 text-xs text-ink-soft">{lastSeen(m.user.sessions[0]?.updatedAt)}</td>
                    <td className="px-5 py-3 text-right">
                      {canRemove && (
                        <ActionButton action={removeMember.bind(null, m.id)} variant="ghost" confirmText={self ? "Leave this event team?" : `Remove ${m.user.name} from the team? Their tasks become unassigned.`}>
                          {self ? "Leave" : "Remove"}
                        </ActionButton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {invites.length > 0 && (
        <Card title="Pending invites">
          <ul className="divide-y divide-line">
            {invites.map((i) => {
              const expired = i.expiresAt <= now;
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{i.email}</p>
                    <p className="text-xs text-ink-soft">
                      {ROLE_LABELS[i.role]}{i.title && ` · ${i.title}`} · invited by {i.invitedBy?.name ?? "someone"} on {formatDate(i.createdAt)} ·{" "}
                      <span className={cx(expired && "text-rose-700")}>{expired ? "expired" : `expires ${formatDate(i.expiresAt)}`}</span>
                    </p>
                  </div>
                  {!expired && <CopyButton text={`${appUrl()}/invite/${i.token}`} label="Copy link" />}
                  <ActionButton action={revokeInvite.bind(null, i.id)} variant="ghost" confirmText={`Revoke the invite for ${i.email}?`}>Revoke</ActionButton>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card title="What each role can do">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs text-ink-soft">
              <tr>
                <th className="py-2 pr-4 font-medium" />
                {EVENT_ROLES.map((r) => <th key={r} className="px-3 py-2 text-center font-medium">{ROLE_LABELS[r]}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {PERMISSION_MATRIX.map((row) => (
                <tr key={row.label}>
                  <td className="py-2 pr-4">{row.label}</td>
                  {EVENT_ROLES.map((r) => (
                    <td key={r} className="px-3 py-2 text-center">
                      {atLeast(r, row.min) ? <Check className="mx-auto size-4 text-emerald-600" /> : <Minus className="mx-auto size-4 text-neutral-300" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
