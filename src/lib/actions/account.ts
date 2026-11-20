"use server";

import { headers } from "next/headers";
import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/dal";
import type { ActionState } from "@/lib/validation";

/** For accounts created with a passcode or social login: add a password. */
export async function setAccountPassword(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const password = String(form.get("password") ?? "");
  if (password.length < 10) return { ok: false, message: "Use at least 10 characters.", errors: { password: ["At least 10 characters"] } };
  if (password !== String(form.get("confirm") ?? "")) return { ok: false, message: "The passwords don't match.", errors: { confirm: ["Doesn't match"] } };
  try {
    await auth.api.setPassword({ body: { newPassword: password }, headers: await headers() });
  } catch (err) {
    await audit({ category: "account", action: "account.set-password", outcome: "failure", targetType: "user", targetId: user.id, summary: user.email });
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't set the password. Sign in again and retry." };
  }
  // Server-side auth.api calls skip Better Auth's hooks, so record it here.
  await audit({ category: "account", action: "account.set-password", targetType: "user", targetId: user.id, summary: user.email });
  return { ok: true, message: "Password set. You can now sign in with it." };
}
