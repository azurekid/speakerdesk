import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Health probe for Azure Container Apps.
 *   GET /api/health          → liveness (process is up)
 *   GET /api/health?deep=1   → readiness (database reachable)
 */
export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("deep") !== "1") return NextResponse.json({ ok: true });
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, database: "up" });
  } catch {
    return NextResponse.json({ ok: false, database: "down" }, { status: 503 });
  }
}
