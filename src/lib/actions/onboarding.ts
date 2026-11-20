"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { getOnboarding } from "@/lib/onboarding";
import { type ActionState, fieldErrors, formToObject } from "@/lib/validation";

const detailsSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  pronouns: z.string().trim().max(40).default(""),
  phone: z
    .string()
    .trim()
    .max(40)
    .default("")
    .refine((v) => v === "" || /^\+?[0-9 ()-]{6,}$/.test(v), "Use digits, spaces and an optional +country code"),
  country: z.string().trim().min(2, "Where are you based?").max(80),
  city: z.string().trim().max(80).default(""),
  timezone: z.string().trim().min(1, "Pick your timezone").max(80).refine((v) => Intl.supportedValuesOf("timeZone").includes(v) || v === "UTC", "Pick a timezone from the list"),
  company: z.string().trim().max(120).default(""),
  jobTitle: z.string().trim().max(120).default(""),
  primaryRole: z.enum(["SPEAKER", "ORGANIZER", "SPONSOR"], { message: "Tell us what brings you here" }),
  terms: z.literal("on", { message: "Please accept the terms to continue" }),
});

export async function saveOnboardingDetails(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = detailsSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, message: "A few details are missing.", errors: fieldErrors(parsed.error) };
  const { primaryRole, terms: _terms, ...profile } = parsed.data;
  await prisma.$transaction([
    prisma.speakerProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...profile }, update: profile }),
    prisma.user.update({
      where: { id: user.id },
      data: { name: profile.fullName, primaryRole, termsAcceptedAt: (await prisma.user.findUnique({ where: { id: user.id }, select: { termsAcceptedAt: true } }))?.termsAcceptedAt ?? new Date() },
    }),
  ]);
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

export async function finishOnboarding(): Promise<void> {
  const user = await requireUser();
  const o = await getOnboarding(user.id);
  if (!o.requiredDone) return;
  await prisma.user.update({ where: { id: user.id }, data: { onboardedAt: new Date() } });
  revalidatePath("/", "layout");
  redirect({ SPEAKER: "/dashboard", ORGANIZER: "/organize", SPONSOR: "/sponsor" }[o.role]);
}
