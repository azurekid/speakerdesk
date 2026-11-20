import "server-only";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { deletePublicFiles } from "@/lib/storage";

/** Events where this user is the only owner — deleting them would orphan the event. */
export async function soleOwnedEvents(userId: string): Promise<string[]> {
  const owned = await prisma.eventMember.findMany({ where: { userId, role: "OWNER" }, select: { eventId: true, event: { select: { name: true } } } });
  const names: string[] = [];
  for (const m of owned) if ((await prisma.eventMember.count({ where: { eventId: m.eventId, role: "OWNER" } })) <= 1) names.push(m.event.name);
  return names;
}

/**
 * Erases what the database cascade doesn't reach: uploaded headshots, sent-mail records and
 * pending team invites addressed to the email. Runs after the user row is deleted.
 * Audit entries stay for their 90-day retention (security record, see /privacy).
 */
export async function eraseLeftovers(user: { id: string; email: string }, how: "self" | "admin") {
  const problems: string[] = [];
  const files = await deletePublicFiles(user.id).catch((e) => (problems.push(`files: ${e}`), 0));
  const mails = await prisma.outboundEmail.deleteMany({ where: { to: user.email } }).catch((e) => (problems.push(`outbox: ${e}`), { count: 0 }));
  const invites = await prisma.eventInvite.deleteMany({ where: { email: user.email } }).catch((e) => (problems.push(`invites: ${e}`), { count: 0 }));
  await audit({
    category: how === "self" ? "account" : "admin",
    action: how === "self" ? "account.delete" : "user.erase-leftovers",
    outcome: problems.length ? "failure" : "success",
    targetType: "user",
    targetId: user.id,
    summary: user.email,
    metadata: { files, emails: mails.count, invites: invites.count, ...(problems.length ? { problems } : {}) },
    ...(how === "self" ? { actor: { id: user.id, email: user.email } } : {}),
  });
  if (problems.length) console.error("Account erasure incomplete", user.id, problems);
}
