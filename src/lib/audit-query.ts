import "server-only";
import type { Prisma } from "@/generated/prisma/client";

export const AUDIT_CATEGORIES = { all: "All", auth: "Sign-in", account: "Account", data: "Data changes", admin: "Admin" } as const;

type SearchParams = Record<string, string | string[] | undefined>;

/** Filters shared by Admin → Audit log and its CSV export. */
export function auditWhere(sp: SearchParams): Prisma.AuditLogWhereInput {
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const category = str("category");
  const q = str("q");
  return {
    ...(category && category in AUDIT_CATEGORIES && category !== "all" ? { category } : {}),
    ...(str("outcome") === "failure" ? { outcome: "failure" } : {}),
    ...(str("user") ? { OR: [{ actorId: str("user") }, { targetType: "user", targetId: str("user") }] } : {}),
    ...(q
      ? { AND: [{ OR: [{ action: { contains: q, mode: "insensitive" } }, { actorEmail: { contains: q, mode: "insensitive" } }, { summary: { contains: q, mode: "insensitive" } }, { targetId: q }, { ipAddress: q }] }] }
      : {}),
  };
}

