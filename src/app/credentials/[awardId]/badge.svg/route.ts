import { badgeSvg } from "@/lib/badge-art";
import { badgeTopText } from "@/lib/badges";
import { prisma } from "@/lib/db";

/** The badge as a standalone SVG file — only for accepted badges the recipient shows publicly. */
export async function GET(_request: Request, { params }: RouteContext<"/credentials/[awardId]/badge.svg">) {
  const { awardId } = await params;
  const a = await prisma.badgeAward.findUnique({ where: { id: awardId }, include: { badge: true, event: { select: { name: true, startDate: true } } } });
  if (!a || a.status !== "ACCEPTED" || !a.showOnProfile) return new Response("Not found", { status: 404 });
  const svg = badgeSvg({ icon: a.badge.icon, color: a.badge.color, label: a.badge.name, topText: badgeTopText(a.event.name, a.event.startDate) });
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
      // Rendered as an image only; nothing in it may run.
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
