"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { SLOT_HOLDING_STATUSES, SPONSORSHIP_STATUSES, type SponsorshipStatus } from "@/lib/domain";
import { eventAccessOrNull } from "@/lib/organizer";
import {
  type ActionState, budgetSchema, fieldErrors, formToObject, packageSchema, sponsorOrgSchema, sponsorshipRequestSchema,
} from "@/lib/validation";

function revalidateSponsorship(eventId: string, slug?: string) {
  revalidatePath(`/organize/${eventId}`, "layout");
  revalidatePath("/sponsor", "layout");
  if (slug) revalidatePath(`/events/${slug}`);
}

// ─── Organizer: budget, prospectus, packages, pipeline ──────────────────────

export async function saveBudget(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const access = await eventAccessOrNull(user, eventId, "ORGANIZER");
  if (!access) return { ok: false, message: "Only owners and co-organizers can change the budget." };
  const parsed = budgetSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };
  await prisma.event.update({ where: { id: eventId }, data: parsed.data });
  revalidateSponsorship(eventId, access.event.slug);
  return { ok: true, message: "Budget saved." };
}

export async function setSponsorshipOpen(eventId: string, open: boolean): Promise<void> {
  const user = await requireUser();
  const access = await eventAccessOrNull(user, eventId, "ORGANIZER");
  if (!access) return;
  await prisma.event.update({ where: { id: eventId }, data: { sponsorshipOpen: open } });
  revalidateSponsorship(eventId, access.event.slug);
}

function parsePackage(form: FormData) {
  return packageSchema.safeParse(formToObject(form, ["benefits", "deliverables"]));
}

export async function createPackage(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const access = await eventAccessOrNull(user, eventId, "ORGANIZER");
  if (!access) return { ok: false, message: "Only owners and co-organizers can manage packages." };
  const parsed = parsePackage(form);
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };
  const last = await prisma.sponsorPackage.aggregate({ where: { eventId }, _max: { sortOrder: true } });
  await prisma.sponsorPackage.create({ data: { ...parsed.data, eventId, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
  revalidateSponsorship(eventId, access.event.slug);
  redirect(`/organize/${eventId}/sponsors/packages`);
}

export async function updatePackage(packageId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const pkg = await prisma.sponsorPackage.findUnique({ where: { id: packageId } });
  const access = pkg && (await eventAccessOrNull(user, pkg.eventId, "ORGANIZER"));
  if (!pkg || !access) return { ok: false, message: "Package not found." };
  const parsed = parsePackage(form);
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };
  // Price changes never touch existing deals: those keep their line-item snapshot.
  await prisma.sponsorPackage.update({ where: { id: packageId }, data: parsed.data });
  revalidateSponsorship(pkg.eventId, access.event.slug);
  redirect(`/organize/${pkg.eventId}/sponsors/packages`);
}

export async function deletePackage(packageId: string): Promise<void> {
  const user = await requireUser();
  const pkg = await prisma.sponsorPackage.findUnique({ where: { id: packageId }, include: { _count: { select: { items: true } } } });
  const access = pkg && (await eventAccessOrNull(user, pkg.eventId, "ORGANIZER"));
  if (!pkg || !access) return;
  if (pkg._count.items > 0) {
    // Sold before: keep it for the records, just take it off the prospectus.
    await prisma.sponsorPackage.update({ where: { id: packageId }, data: { published: false } });
  } else {
    await prisma.sponsorPackage.delete({ where: { id: packageId } });
  }
  revalidateSponsorship(pkg.eventId, access.event.slug);
}

export async function setDealStatus(sponsorshipId: string, status: SponsorshipStatus): Promise<void> {
  const user = await requireUser();
  if (!SPONSORSHIP_STATUSES.includes(status)) return;
  const deal = await prisma.sponsorship.findUnique({ where: { id: sponsorshipId } });
  const access = deal && (await eventAccessOrNull(user, deal.eventId, "ORGANIZER"));
  if (!deal || !access) return;
  await prisma.sponsorship.update({
    where: { id: sponsorshipId },
    data: { status, decidedAt: deal.status === "APPLIED" && status !== "APPLIED" ? new Date() : undefined },
  });
  revalidateSponsorship(deal.eventId, access.event.slug);
}

// ─── Sponsor: company, requests, deliverables ───────────────────────────────

export async function saveSponsorOrg(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = sponsorOrgSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };
  await prisma.sponsorOrg.upsert({ where: { ownerId: user.id }, create: { ...parsed.data, ownerId: user.id }, update: parsed.data });
  revalidatePath("/sponsor", "layout");
  const next = String(form.get("next") ?? "");
  if (next.startsWith("/sponsor/") && !next.startsWith("//")) redirect(next);
  return { ok: true, message: "Company profile saved." };
}

export async function requestSponsorship(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const org = await prisma.sponsorOrg.findUnique({ where: { ownerId: user.id } });
  if (!org) return { ok: false, message: "Set up your company profile first." };
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || !event.sponsorshipOpen) return { ok: false, message: "This event isn't taking sponsors right now." };

  const parsed = sponsorshipRequestSchema.safeParse(formToObject(form, ["packageIds", "requirements"]));
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };
  const { packageIds, ...details } = parsed.data;

  const packages = await prisma.sponsorPackage.findMany({ where: { id: { in: packageIds }, eventId, published: true } });
  if (!packages.length || packages.length !== packageIds.length) return { ok: false, message: "Pick at least one package.", errors: { packageIds: ["Pick a package or add-on"] } };
  if (packages.filter((p) => p.kind === "TIER").length > 1) return { ok: false, message: "Choose one sponsorship tier (add-ons can be combined).", errors: { packageIds: ["Only one tier"] } };

  const active = await prisma.sponsorship.count({ where: { eventId, sponsorOrgId: org.id, status: { in: SLOT_HOLDING_STATUSES } } });
  if (active) return { ok: false, message: "You already have an open sponsorship for this event. Talk to the organizers to change it." };

  try {
    await prisma.$transaction(
      async (tx) => {
        // Re-check availability inside a serializable transaction so limited packages can't be oversold.
        for (const p of packages) {
          if (p.quantity === null) continue;
          const taken = await tx.sponsorshipItem.count({ where: { packageId: p.id, sponsorship: { status: { in: SLOT_HOLDING_STATUSES } } } });
          if (taken >= p.quantity) throw new SoldOut(p.name);
        }
        await tx.sponsorship.create({
          data: {
            ...details,
            eventId,
            sponsorOrgId: org.id,
            items: { create: packages.map((p) => ({ packageId: p.id, kind: p.kind, name: p.name, price: p.price, deliverables: p.deliverables })) },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (err) {
    if (err instanceof SoldOut) return { ok: false, message: `${err.message} just sold out. Pick another option.` };
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") return { ok: false, message: "Someone else was booking at the same moment, please try again." };
    throw err;
  }
  revalidateSponsorship(eventId, event.slug);
  redirect("/sponsor/deals?requested=1");
}

class SoldOut extends Error {}

export async function cancelSponsorship(sponsorshipId: string): Promise<void> {
  const user = await requireUser();
  const deal = await prisma.sponsorship.findFirst({ where: { id: sponsorshipId, sponsorOrg: { ownerId: user.id } }, include: { event: true } });
  if (!deal || deal.status !== "APPLIED") return;
  await prisma.sponsorship.update({ where: { id: sponsorshipId }, data: { status: "CANCELLED" } });
  revalidateSponsorship(deal.eventId, deal.event.slug);
}

export async function toggleDeliverable(sponsorshipId: string, deliverable: string, done: boolean): Promise<void> {
  const user = await requireUser();
  const deal = await prisma.sponsorship.findFirst({ where: { id: sponsorshipId, sponsorOrg: { ownerId: user.id } }, include: { items: true } });
  if (!deal) return;
  const allowed = new Set(deal.items.flatMap((i) => i.deliverables));
  if (!allowed.has(deliverable)) return;
  const set = new Set(deal.completedDeliverables);
  if (done) set.add(deliverable);
  else set.delete(deliverable);
  await prisma.sponsorship.update({ where: { id: sponsorshipId }, data: { completedDeliverables: [...set] } });
  revalidatePath("/sponsor/deals");
  revalidatePath(`/organize/${deal.eventId}`, "layout");
}
