import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/dal";
import { mvpRows, toCsv } from "@/lib/mvp-export";
import { NextResponse } from "next/server";

/** Delivered talks as a CSV laid out like the MVP portal's speaking form. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await audit({ category: "account", action: "account.export.mvp", targetType: "user", targetId: user.id, summary: user.email });
  const rows = await mvpRows(user.id);
  return new NextResponse("﻿" + toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="speakerdesk-mvp-activities.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
