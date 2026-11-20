import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { talkToMarkdown } from "@/lib/export";

export async function GET(_req: Request, ctx: RouteContext<"/api/sessions/[id]/markdown">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  const talk = await prisma.talk.findFirst({ where: { id, userId: user.id } });
  if (!talk) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const slug = talk.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "session";
  return new NextResponse(talkToMarkdown(talk), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.md"`,
      "Cache-Control": "no-store",
    },
  });
}
