import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/dal";
import { talksToCsv } from "@/lib/export";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await audit({ category: "account", action: "account.export.csv", targetType: "user", targetId: user.id, summary: user.email });
  const talks = await prisma.talk.findMany({ where: { userId: user.id }, orderBy: { title: "asc" } });
  return new NextResponse("﻿" + talksToCsv(talks), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="speakerdesk-sessions.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
