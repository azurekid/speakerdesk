"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { appUrl, eventAccessOrNull } from "@/lib/organizer";
import { assignableRoles, canAdmin, canManage, EVENT_ROLES, type EventRole, ROLE_LABELS } from "@/lib/permissions";
import { INVITE_TTL_DAYS, newInviteToken } from "@/lib/team";

export type InviteState =
  | undefined
  | { ok: boolean; message: string; added?: string[]; links?: { email: string; url: string }[]; skipped?: string[] };

const emailList = z
  .string()
  .transform((v) => [...new Set(v.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))]);

export async function inviteMembers(eventId: string, _prev: InviteState, form: FormData): Promise<InviteState> {
  const user = await requireUser();
  const access = await eventAccessOrNull(user, eventId, "ORGANIZER");
  if (!access) return { ok: false, message: "Only owners and co-organizers can invite people." };

  const role = String(form.get("role") ?? "REVIEWER") as EventRole;
  if (!EVENT_ROLES.includes(role) || !assignableRoles(access.role).includes(role)) return { ok: false, message: "You can't hand out that role." };
  const title = String(form.get("title") ?? "").trim().slice(0, 80);
  const emails = emailList.parse(String(form.get("emails") ?? ""));
  if (!emails.length) return { ok: false, message: "Enter at least one email address." };
  if (emails.length > 25) return { ok: false, message: "Invite at most 25 people at a time." };
  const invalid = emails.filter((e) => !z.email().safeParse(e).success);
  if (invalid.length) return { ok: false, message: `Not a valid email: ${invalid.join(", ")}` };

  const added: string[] = [];
  const skipped: string[] = [];
  const links: { email: string; url: string }[] = [];
  for (const email of emails) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      const member = await prisma.eventMember.findUnique({ where: { eventId_userId: { eventId, userId: existing.id } } });
      if (member) {
        skipped.push(`${existing.name} is already on the team`);
        continue;
      }
      await prisma.eventMember.create({ data: { eventId, userId: existing.id, role, title } });
      added.push(existing.name);
    } else {
      // No account yet: keep a pending invite. It's claimed when they sign up with this email.
      const token = newInviteToken();
      await prisma.eventInvite.upsert({
        where: { eventId_email: { eventId, email } },
        create: { eventId, email, role, title, token, invitedById: user.id, expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000) },
        update: { role, title, token, invitedById: user.id, acceptedAt: null, expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000) },
      });
      links.push({ email, url: `${appUrl()}/invite/${token}` });
    }
  }
  revalidatePath(`/organize/${eventId}/team`);
  revalidatePath("/organize/people");
  const parts = [
    added.length && `${added.length} added as ${ROLE_LABELS[role].toLowerCase()}`,
    links.length && `${links.length} invited — share the link${links.length === 1 ? "" : "s"} below`,
  ].filter(Boolean);
  return { ok: true, message: parts.join(" · ") || "Nothing to do.", added, links, skipped };
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const user = await requireUser();
  const invite = await prisma.eventInvite.findUnique({ where: { id: inviteId } });
  if (!invite || !(await eventAccessOrNull(user, invite.eventId, "ORGANIZER"))) return;
  await prisma.eventInvite.delete({ where: { id: inviteId } });
  revalidatePath(`/organize/${invite.eventId}/team`);
  revalidatePath("/organize/people");
}

export async function changeMemberRole(memberId: string, role: EventRole): Promise<void> {
  const user = await requireUser();
  if (!EVENT_ROLES.includes(role)) return;
  const member = await prisma.eventMember.findUnique({ where: { id: memberId } });
  const access = member && (await eventAccessOrNull(user, member.eventId, "OWNER"));
  if (!member || !access) return;
  if (member.role === "OWNER" && role !== "OWNER") {
    const owners = await prisma.eventMember.count({ where: { eventId: member.eventId, role: "OWNER" } });
    if (owners <= 1) return; // an event always keeps an owner
  }
  await prisma.eventMember.update({ where: { id: memberId }, data: { role } });
  revalidatePath(`/organize/${member.eventId}`, "layout");
  revalidatePath("/organize/people");
}

/** Owners can remove anyone; co-organizers can remove reviewers and volunteers; everyone can leave. */
export async function removeMember(memberId: string): Promise<void> {
  const user = await requireUser();
  const member = await prisma.eventMember.findUnique({ where: { id: memberId } });
  if (!member) return;
  const self = member.userId === user.id;
  const access = await eventAccessOrNull(user, member.eventId, "VOLUNTEER");
  if (!access) return;
  const allowed = self || canAdmin(access.role) || (canManage(access.role) && !canManage(member.role));
  if (!allowed) return;
  if (member.role === "OWNER") {
    const owners = await prisma.eventMember.count({ where: { eventId: member.eventId, role: "OWNER" } });
    if (owners <= 1) return;
  }
  await prisma.$transaction([
    prisma.runbookTask.updateMany({ where: { eventId: member.eventId, assigneeId: member.userId }, data: { assigneeId: null } }),
    prisma.eventMember.delete({ where: { id: memberId } }),
  ]);
  revalidatePath(`/organize/${member.eventId}`, "layout");
  revalidatePath("/organize/people");
  if (self) redirect("/organize");
}

export async function acceptInvite(token: string): Promise<void> {
  const user = await requireUser();
  const invite = await prisma.eventInvite.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) redirect(`/invite/${token}`);
  // Invites are personal: only the invited email can use the link.
  if (invite.email !== user.email.toLowerCase()) redirect(`/invite/${token}`);
  await prisma.$transaction([
    prisma.eventMember.upsert({
      where: { eventId_userId: { eventId: invite.eventId, userId: user.id } },
      create: { eventId: invite.eventId, userId: user.id, role: invite.role, title: invite.title },
      update: {},
    }),
    prisma.eventInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
    prisma.user.update({ where: { id: user.id }, data: { primaryRole: "ORGANIZER" } }),
  ]);
  revalidatePath("/organize", "layout");
  redirect(`/organize/${invite.eventId}`);
}
