import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { ticketUrl } from "@/lib/tickets";

/** The ticket's QR code: the ticket link, so any phone camera can open it. Real tickets only. */
export async function GET(_request: Request, { params }: RouteContext<"/tickets/[code]/qr.png">) {
  const { code } = await params;
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(code)) return new Response("Not found", { status: 404 });
  const reg = await prisma.registration.findUnique({ where: { code }, select: { id: true } });
  if (!reg) return new Response("Not found", { status: 404 });
  const png = await QRCode.toBuffer(ticketUrl(code), { type: "png", width: 512, margin: 2, errorCorrectionLevel: "M" });
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=86400" } });
}
