"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "@/lib/domain";
import { type ActionState, fieldErrors, formToObject, type SubmissionInput, submissionSchema } from "@/lib/validation";

type Parsed =
  | { error: ActionState; data?: undefined }
  | { error?: undefined; data: Omit<SubmissionInput, "talkId"> & { talkId: string | null } };

async function parseOwned(userId: string, form: FormData): Promise<Parsed> {
  const parsed = submissionSchema.safeParse(formToObject(form));
  if (!parsed.success) return { error: { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) } };
  const { talkId, ...rest } = parsed.data;
  if (talkId) {
    // Never trust a client-supplied foreign key: the talk must belong to this user.
    const owned = await prisma.talk.count({ where: { id: talkId, userId } });
    if (!owned) return { error: { ok: false, message: "Unknown session.", errors: { talkId: ["Unknown session"] } } };
  }
  return { data: { ...rest, talkId: talkId || null } };
}

function revalidate(talkId?: string | null) {
  revalidatePath("/submissions");
  revalidatePath("/dashboard");
  if (talkId) revalidatePath(`/sessions/${talkId}`);
}

export async function createSubmission(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const result = await parseOwned(user.id, form);
  if (!result.data) return result.error;
  await prisma.submission.create({ data: { ...result.data, userId: user.id } });
  revalidate(result.data.talkId);
  redirect("/submissions");
}

export async function updateSubmission(id: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const result = await parseOwned(user.id, form);
  if (!result.data) return result.error;
  const { count } = await prisma.submission.updateMany({ where: { id, userId: user.id }, data: result.data });
  if (count === 0) return { ok: false, message: "Submission not found." };
  revalidate(result.data.talkId);
  redirect("/submissions");
}

export async function setSubmissionStatus(id: string, status: SubmissionStatus): Promise<void> {
  const user = await requireUser();
  if (!SUBMISSION_STATUSES.includes(status)) return;
  const now = new Date();
  const existing = await prisma.submission.findFirst({ where: { id, userId: user.id } });
  if (!existing) return;
  await prisma.submission.update({
    where: { id },
    data: {
      status,
      submittedAt: status === "SUBMITTED" && !existing.submittedAt ? now : undefined,
      decisionAt: ["ACCEPTED", "REJECTED", "WAITLISTED"].includes(status) ? now : undefined,
    },
  });
  revalidate(existing.talkId);
}

export async function deleteSubmission(id: string): Promise<void> {
  const user = await requireUser();
  await prisma.submission.deleteMany({ where: { id, userId: user.id } });
  revalidate();
  redirect("/submissions");
}
