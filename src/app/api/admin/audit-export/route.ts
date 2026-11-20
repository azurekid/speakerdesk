import { audit } from "@/lib/audit";
import { auditWhere } from "@/lib/audit-query";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";

const MAX_ROWS = 50_000;

/** CSV of the audit log with the same filters as Admin → Audit log. The export itself is audited. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return new Response("Not found", { status: 404 });
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const rows = await prisma.auditLog.findMany({ where: auditWhere(sp), orderBy: { createdAt: "desc" }, take: MAX_ROWS });
  await audit({ category: "admin", action: "audit.export", targetType: "audit", targetId: "csv", metadata: { filters: sp, rows: rows.length } });

  // Neutralise spreadsheet formulas (CSV injection) and quote every cell.
  const cell = (v: unknown) => {
    let s = v == null ? "" : typeof v === "string" ? v : v instanceof Date ? v.toISOString() : JSON.stringify(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const cols = ["createdAt", "category", "action", "outcome", "actorId", "actorEmail", "impersonatorId", "targetType", "targetId", "summary", "metadata", "ipAddress", "userAgent"] as const;
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
