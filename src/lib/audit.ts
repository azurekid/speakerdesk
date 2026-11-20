import "server-only";
import { headers } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { prismaBase } from "@/lib/db";

import { AUDIT_RETENTION_DAYS } from "@/lib/audit-constants";

export { AUDIT_RETENTION_DAYS };

export type AuditCategory = "auth" | "account" | "data" | "admin";

export type AuditActor = { id: string; email: string; impersonatedBy?: string | null } | null;

export type AuditEntry = {
  category: AuditCategory;
  action: string;
  targetType: string;
  targetId: string;
  outcome?: "success" | "failure";
  summary?: string;
  metadata?: Prisma.InputJsonValue;
  /** Omit to use the signed-in user of the current request; pass null for "nobody/unknown". */
  actor?: AuditActor;
  /** Request headers when not inside a Next.js request scope (e.g. Better Auth hooks). */
  requestHeaders?: Headers | null;
};

/**
 * The client's IP. The Container Apps ingress *appends* the real peer address to
 * X-Forwarded-For, so the right-most entry is the one a client can't forge.
 */
function clientIp(h: Headers | null): string {
  const xff = h?.get("x-forwarded-for");
  if (!xff) return "";
  const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
  return (parts.at(-1) ?? "").slice(0, 64);
}

async function requestHeaders(): Promise<Headers | null> {
  try {
    return await headers();
  } catch {
    return null; // outside a request (build, scripts)
  }
}

async function currentActor(): Promise<AuditActor> {
  try {
    // Imported lazily: dal → auth → audit would otherwise be a cycle at module load.
    const { getCurrentUser } = await import("@/lib/dal");
    const user = await getCurrentUser();
    return user ? { id: user.id, email: user.email, impersonatedBy: user.impersonatedBy } : null;
  } catch {
    return null;
  }
}

let lastPrune = 0;
/**
 * Enforces the retention periods promised in /privacy. Runs at most hourly per replica,
 * piggybacking on audit writes (there's always traffic), so no scheduler is needed.
 */
async function pruneIfDue() {
  const now = Date.now();
  if (now - lastPrune < 60 * 60 * 1000) return;
  lastPrune = now;
  const cutoff = new Date(now - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const [auditRows, emails, sessions, verifications] = await Promise.all([
    prismaBase.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prismaBase.outboundEmail.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prismaBase.session.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }),
    prismaBase.verification.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }),
  ]);
  console.log(JSON.stringify({ audit: "retention", olderThan: cutoff.toISOString(), auditLog: auditRows.count, outboundEmail: emails.count, expiredSessions: sessions.count, expiredVerifications: verifications.count }));
}

/**
 * Records an audit entry in the database (kept 90 days, visible under Admin → Audit log)
 * and as a structured log line (Log Analytics, also 90 days). Never throws: auditing must
 * not break the action being audited, but a failed write is logged loudly.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const h = entry.requestHeaders !== undefined ? entry.requestHeaders : await requestHeaders();
    const actor = entry.actor !== undefined ? entry.actor : await currentActor();
    const row = {
      actorId: actor?.id ?? null,
      actorEmail: actor?.email ?? "",
      impersonatorId: actor?.impersonatedBy ?? null,
      category: entry.category,
      action: entry.action,
      outcome: entry.outcome ?? "success",
      targetType: entry.targetType,
      targetId: entry.targetId.slice(0, 200),
      summary: (entry.summary ?? "").slice(0, 500),
      metadata: entry.metadata,
      ipAddress: clientIp(h),
      userAgent: (h?.get("user-agent") ?? "").slice(0, 300),
    };
    // actorId may point to a user deleted in the same request — keep the entry anyway.
    await prismaBase.auditLog.create({ data: row }).catch(async (e: unknown) => {
      if ((e as { code?: string }).code !== "P2003") throw e;
      await prismaBase.auditLog.create({ data: { ...row, actorId: null } });
    });
    console.log(JSON.stringify({ audit: row.action, ...row, metadata: row.metadata ?? null }));
    await pruneIfDue();
  } catch (e) {
    console.error("AUDIT WRITE FAILED", entry.action, entry.targetType, entry.targetId, e);
  }
}

// ─── Data changes (wired into the Prisma client in src/lib/db.ts) ───────────

const MUTATIONS = new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn", "upsert", "delete", "deleteMany"]);

/** Models that are logged elsewhere (auth hooks) or are pure bookkeeping. */
const NOT_AUDITED = new Set(["AuditLog", "RateLimit", "Session", "Verification", "Account", "OutboundEmail"]);

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function changedFields(operation: string, args: Record<string, unknown>): string[] {
  const pick = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v) : []);
  if (operation === "upsert") return [...new Set([...pick(args.create), ...pick(args.update)])];
  if (operation.startsWith("createMany")) return pick(Array.isArray(args.data) ? args.data[0] : args.data);
  return pick(args.data);
}

function idOf(result: unknown, args: Record<string, unknown>): string {
  const r = result as { id?: unknown } | null;
  if (r && typeof r.id === "string") return r.id;
  const where = args.where as Record<string, unknown> | undefined;
  if (where && typeof where.id === "string") return where.id;
  return where ? JSON.stringify(where).slice(0, 200) : "";
}

export function isAuditedMutation(model: string | undefined, operation: string): model is string {
  return Boolean(model) && MUTATIONS.has(operation) && !NOT_AUDITED.has(model!);
}

/** One entry per write: which record, which operation and which fields — never the values. */
export async function auditDataChange(model: string, operation: string, args: Record<string, unknown>, result: unknown) {
  const fields = changedFields(operation, args);
  // `upsert(..., update: {})` is the "make sure it exists" idiom (page loads, sign-up):
  // not a user change, and the sign-up itself is already audited.
  if (operation === "upsert" && Object.keys((args.update as object) ?? {}).length === 0) return;
  const many = operation.endsWith("Many") || operation.endsWith("ManyAndReturn");
  const count = many ? ((result as { count?: number })?.count ?? (Array.isArray(result) ? result.length : undefined)) : undefined;
  if (many && count === 0) return;
  await audit({
    category: "data",
    action: `data.${lowerFirst(model)}.${operation}`,
    targetType: lowerFirst(model),
    targetId: many ? "many" : idOf(result, args),
    metadata: { fields, ...(count !== undefined ? { count } : {}) },
  });
}
