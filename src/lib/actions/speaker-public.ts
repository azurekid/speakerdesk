"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { type ActionState, fieldErrors, formToObject, publicProfileSchema } from "@/lib/validation";

function slugFromName(name: string) {
  return name.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").slice(0, 40) || "speaker";
}

export async function savePublicProfile(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = publicProfileSchema.safeParse(formToObject(form, ["topics"]));
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };
  const profile = await prisma.speakerProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, fullName: user.name }, update: {} });

  let slug = parsed.data.slug || profile.slug || slugFromName(profile.fullName || user.name);
  const taken = await prisma.speakerProfile.findFirst({ where: { slug, NOT: { userId: user.id } } });
  if (taken) {
    if (parsed.data.slug) return { ok: false, message: "That address is taken.", errors: { slug: ["Already taken — try another"] } };
    slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
  }
  if (parsed.data.publicProfile && !profile.fullName) return { ok: false, message: "Add your name to the profile before going public." };

  await prisma.speakerProfile.update({ where: { userId: user.id }, data: { ...parsed.data, slug } });
  revalidatePath("/profile");
  revalidatePath("/speakers", "layout");
  return { ok: true, message: parsed.data.publicProfile ? "Your speaker page is live." : "Saved. Your speaker page is private." };
}

export async function setTalkPublished(talkId: string, published: boolean): Promise<void> {
  const user = await requireUser();
  await prisma.talk.updateMany({ where: { id: talkId, userId: user.id }, data: { published } });
  revalidatePath(`/sessions/${talkId}`);
  revalidatePath("/sessions");
  revalidatePath("/speakers", "layout");
}
