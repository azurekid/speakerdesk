"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { type ActionState, fieldErrors, formToObject, talkSchema } from "@/lib/validation";

function parse(form: FormData) {
  return talkSchema.safeParse(formToObject(form, ["takeaways", "tags"]));
}

export async function createTalk(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parse(form);
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };

  const talk = await prisma.talk.create({ data: { ...parsed.data, userId: user.id } });
  revalidatePath("/sessions");
  redirect(`/sessions/${talk.id}`);
}

export async function updateTalk(id: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parse(form);
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };

  const { count } = await prisma.talk.updateMany({ where: { id, userId: user.id }, data: parsed.data });
  if (count === 0) return { ok: false, message: "Session not found." };
  revalidatePath("/sessions");
  revalidatePath(`/sessions/${id}`);
  redirect(`/sessions/${id}`);
}

export async function duplicateTalk(id: string): Promise<void> {
  const user = await requireUser();
  const src = await prisma.talk.findFirst({ where: { id, userId: user.id } });
  if (!src) return;
  const { id: _id, createdAt: _c, updatedAt: _u, importRef: _r, importSource: _s, customFields, ...rest } = src;
  const copy = await prisma.talk.create({
    data: { ...rest, title: `${src.title} (copy)`, customFields: customFields ?? undefined },
  });
  revalidatePath("/sessions");
  redirect(`/sessions/${copy.id}/edit`);
}

export async function setTalkArchived(id: string, archived: boolean): Promise<void> {
  const user = await requireUser();
  await prisma.talk.updateMany({ where: { id, userId: user.id }, data: { archived } });
  revalidatePath("/sessions");
  revalidatePath(`/sessions/${id}`);
}

export async function deleteTalk(id: string): Promise<void> {
  const user = await requireUser();
  await prisma.talk.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/sessions");
  revalidatePath("/submissions");
  redirect("/sessions");
}
