"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { eraseLeftovers, soleOwnedEvents } from "@/lib/account-deletion";
import { audit as writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { type CurrentUser, requireAdmin } from "@/lib/dal";
import type { ActionState } from "@/lib/validation";

async function audit(actor: CurrentUser, action: string, targetType: string, targetId: string, summary = "") {
  await writeAudit({ category: "admin", action, targetType, targetId, summary, actor: { id: actor.id, email: actor.email, impersonatedBy: actor.impersonatedBy } });
}

const done = (message: string): ActionState => ({ ok: true, message });
const fail = (message: string): ActionState => ({ ok: false, message });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

async function target(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true } });
}

function revalidateUser(userId: string) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/users/${userId}`);
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function adminSetPassword(userId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const user = await target(userId);
  if (!user) return fail("User not found.");
  const password = String(form.get("password") ?? "");
  if (password.length < 10) return fail("Use at least 10 characters.");
  try {
    await auth.api.setUserPassword({ body: { userId, newPassword: password }, headers: await headers() });
    // Existing sessions keep working otherwise — sign them out so the new password takes effect everywhere.
    if (form.get("revoke") === "on") await auth.api.revokeUserSessions({ body: { userId }, headers: await headers() });
  } catch (e) {
    return fail(errMsg(e));
  }
  await audit(admin, "user.set-password", "user", userId, user.email);
  revalidateUser(userId);
  return done("Password set. Share it with the user over a secure channel and ask them to change it.");
}

export async function adminSendResetCode(userId: string): Promise<ActionState> {
  const admin = await requireAdmin();
  const user = await target(userId);
  if (!user) return fail("User not found.");
  try {
    await auth.api.requestPasswordResetEmailOTP({ body: { email: user.email } });
  } catch (e) {
    return fail(errMsg(e));
  }
  await audit(admin, "user.send-reset-code", "user", userId, user.email);
  revalidateUser(userId);
  return done(`Reset code sent to ${user.email}. They can use “Forgot password?” on the sign-in page.`);
}

export async function adminSetVerified(userId: string, verified: boolean): Promise<void> {
  const admin = await requireAdmin();
  await prisma.user.update({ where: { id: userId }, data: { emailVerified: verified } });
  await audit(admin, verified ? "user.mark-verified" : "user.mark-unverified", "user", userId);
  revalidateUser(userId);
}

export async function adminChangeEmail(userId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!z.email().safeParse(email).success) return fail("Enter a valid email address.");
  const user = await target(userId);
  if (!user) return fail("User not found.");
  if (await prisma.user.findFirst({ where: { email, NOT: { id: userId } } })) return fail("Another account already uses that email.");
  await prisma.user.update({ where: { id: userId }, data: { email, emailVerified: form.get("verified") === "on" } });
  await audit(admin, "user.change-email", "user", userId, `${user.email} → ${email}`);
  revalidateUser(userId);
  return done(`Email changed to ${email}.`);
}

export async function adminBan(userId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (userId === admin.id) return fail("You can't ban yourself.");
  const user = await target(userId);
  if (!user) return fail("User not found.");
  const reason = String(form.get("reason") ?? "").trim().slice(0, 300) || "Violation of the terms of use";
  const days = Number(form.get("days") ?? 0);
  try {
    await auth.api.banUser({ body: { userId, banReason: reason, ...(days > 0 ? { banExpiresIn: days * 86_400 } : {}) }, headers: await headers() });
  } catch (e) {
    return fail(errMsg(e));
  }
  await audit(admin, "user.ban", "user", userId, `${user.email}: ${reason}${days > 0 ? ` (${days} days)` : ""}`);
  revalidateUser(userId);
  return done(`${user.name} is banned and signed out everywhere.`);
}

export async function adminUnban(userId: string): Promise<void> {
  const admin = await requireAdmin();
  await auth.api.unbanUser({ body: { userId }, headers: await headers() });
  await audit(admin, "user.unban", "user", userId);
  revalidateUser(userId);
}

export async function adminSetRole(userId: string, role: "admin" | "user"): Promise<void> {
  const admin = await requireAdmin();
  if (role === "user") {
    const admins = await prisma.user.count({ where: { role: "admin" } });
    if (admins <= 1) return; // keep at least one platform admin
  }
  await auth.api.setRole({ body: { userId, role }, headers: await headers() });
  await audit(admin, role === "admin" ? "user.grant-admin" : "user.revoke-admin", "user", userId);
  revalidateUser(userId);
}

export async function adminRevokeSessions(userId: string): Promise<void> {
  const admin = await requireAdmin();
  await auth.api.revokeUserSessions({ body: { userId }, headers: await headers() });
  await audit(admin, "user.revoke-sessions", "user", userId);
  revalidateUser(userId);
}

export async function adminResetOnboarding(userId: string): Promise<void> {
  const admin = await requireAdmin();
  await prisma.user.update({ where: { id: userId }, data: { onboardedAt: null } });
  await audit(admin, "user.reset-onboarding", "user", userId);
  revalidateUser(userId);
}

/** Recorded before the client switches session, so support access is always traceable. */
export async function adminLogImpersonation(userId: string): Promise<void> {
  const admin = await requireAdmin();
  const user = await target(userId);
  await audit(admin, "user.impersonate", "user", userId, user?.email ?? "");
}

export async function adminDeleteUser(userId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (userId === admin.id) return fail("You can't delete your own account here.");
  const user = await target(userId);
  if (!user) return fail("User not found.");
  if (String(form.get("confirm") ?? "").trim().toLowerCase() !== user.email.toLowerCase()) return fail("Type the user's email to confirm.");
  // Don't orphan events: the user must not be the only owner anywhere.
  const soleOwner = await soleOwnedEvents(userId);
  if (soleOwner.length) return fail(`They're the only owner of: ${soleOwner.join(", ")}. Add another owner or delete those events first.`);
  try {
    await auth.api.removeUser({ body: { userId }, headers: await headers() });
  } catch (e) {
    return fail(errMsg(e));
  }
  await audit(admin, "user.delete", "user", userId, user.email);
  await eraseLeftovers(user, "admin");
  revalidatePath("/admin", "layout");
  redirect("/admin/users?deleted=1");
}

// ─── Events ──────────────────────────────────────────────────────────────────

export async function adminModerateEvent(eventId: string, change: "unpublish-cfp" | "close-sponsorship" | "hide-programme"): Promise<void> {
  const admin = await requireAdmin();
  const data = { "unpublish-cfp": { cfpPublished: false }, "close-sponsorship": { sponsorshipOpen: false }, "hide-programme": { programPublished: false } }[change];
  const event = await prisma.event.update({ where: { id: eventId }, data });
  await audit(admin, `event.${change}`, "event", eventId, event.name);
  revalidatePath("/admin/events");
  revalidatePath(`/events/${event.slug}`);
  revalidatePath("/events");
}

/** Support escalation: give the admin owner access to an event's workspace. */
export async function adminJoinEvent(eventId: string): Promise<void> {
  const admin = await requireAdmin();
  await prisma.eventMember.upsert({
    where: { eventId_userId: { eventId, userId: admin.id } },
    create: { eventId, userId: admin.id, role: "OWNER", title: "Platform admin" },
    update: { role: "OWNER" },
  });
  await audit(admin, "event.admin-join", "event", eventId);
  redirect(`/organize/${eventId}`);
}

export async function adminDeleteEvent(eventId: string): Promise<void> {
  const admin = await requireAdmin();
  const event = await prisma.event.delete({ where: { id: eventId } });
  await audit(admin, "event.delete", "event", eventId, event.name);
  revalidatePath("/admin", "layout");
  revalidatePath("/events");
}
