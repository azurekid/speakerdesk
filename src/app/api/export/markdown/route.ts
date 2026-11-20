import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { speakerKitMarkdown } from "@/lib/export";

/** "Speaker kit": profile + all active sessions as one Markdown document. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const [profile, talks] = await Promise.all([
    prisma.speakerProfile.findUnique({ where: { userId: user.id } }),
    prisma.talk.findMany({ where: { userId: user.id, archived: false }, orderBy: { title: "asc" } }),
  ]);
  return new NextResponse(speakerKitMarkdown(profile, talks), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="speaker-kit.md"`,
      "Cache-Control": "no-store",
    },
  });
}
