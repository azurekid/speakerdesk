"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { type ActionState, fieldErrors, formToObject, profileSchema } from "@/lib/validation";

export async function saveProfile(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };

  await prisma.speakerProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...parsed.data },
    update: parsed.data,
  });
  // The display name is the one name shown everywhere (task assignees, team lists, emails,
  // reviews…), so the account name follows it. Without this, the name typed at sign-up sticks.
  const displayName = parsed.data.fullName.trim();
  if (displayName && displayName !== user.name) await prisma.user.update({ where: { id: user.id }, data: { name: displayName } });
  revalidatePath("/profile");
  revalidatePath("/", "layout"); // sidebar, team lists and assignee pickers all show the name
  revalidatePath("/dashboard");
  return { ok: true, message: "Profile saved." };
}
