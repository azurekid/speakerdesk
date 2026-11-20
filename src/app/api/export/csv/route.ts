import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { talksToCsv } from "@/lib/export";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const talks = await prisma.talk.findMany({ where: { userId: user.id }, orderBy: { title: "asc" } });
  return new NextResponse("﻿" + talksToCsv(talks), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="speakerdesk-sessions.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
