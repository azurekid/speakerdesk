import { prisma } from "@/lib/db";
import { appleWalletConfigured, buildPkpass } from "@/lib/wallet/apple";

/** "Add to Apple Wallet": the signed pass for this ticket. */
export async function GET(_request: Request, { params }: RouteContext<"/tickets/[code]/wallet.pkpass">) {
  const { code } = await params;
  if (!appleWalletConfigured() || !/^[A-Za-z0-9_-]{10,64}$/.test(code)) return new Response("Not found", { status: 404 });
  const reg = await prisma.registration.findUnique({ where: { code }, include: { event: true, ticketType: { select: { name: true } } } });
  if (!reg) return new Response("Not found", { status: 404 });
  if (reg.status !== "ACTIVE") return new Response("This ticket was cancelled.", { status: 410 });
  const pass = buildPkpass(reg.event, reg);
  return new Response(new Uint8Array(pass), {
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="${reg.event.slug.replace(/[^a-z0-9-]/gi, "-")}.pkpass"`,
      "Cache-Control": "private, no-store",
    },
  });
}
