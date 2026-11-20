import "server-only";
import { prisma } from "@/lib/db";
import { SLOT_HOLDING_STATUSES } from "@/lib/domain";

/** Packages for an event with how many slots are taken / left. */
export async function getPackages(eventId: string, opts: { publishedOnly?: boolean } = {}) {
  const packages = await prisma.sponsorPackage.findMany({
    where: { eventId, ...(opts.publishedOnly ? { published: true } : {}) },
    include: { items: { where: { sponsorship: { status: { in: SLOT_HOLDING_STATUSES } } }, select: { id: true } } },
    orderBy: [{ kind: "asc" }, { price: "desc" }, { sortOrder: "asc" }],
  });
  return packages.map(({ items, ...p }) => ({
    ...p,
    taken: items.length,
    left: p.quantity === null ? null : Math.max(0, p.quantity - items.length),
  }));
}
export type PackageWithAvailability = Awaited<ReturnType<typeof getPackages>>[number];

export async function getEventDeals(eventId: string) {
  return prisma.sponsorship.findMany({
    where: { eventId },
    include: { items: true, sponsorOrg: true },
    orderBy: { createdAt: "desc" },
  });
}
