import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { googleWalletConfigured, googleWalletSaveUrl } from "@/lib/wallet/google";

/** "Save to Google Wallet": sends the attendee to Google with a signed link for this ticket. */
export async function GET(_request: Request, { params }: RouteContext<"/tickets/[code]/google-wallet">) {
  const { code } = await params;
  if (!googleWalletConfigured() || !/^[A-Za-z0-9_-]{10,64}$/.test(code)) return new Response("Not found", { status: 404 });
  const reg = await prisma.registration.findUnique({ where: { code }, include: { event: true, ticketType: { select: { name: true } } } });
  if (!reg) return new Response("Not found", { status: 404 });
  if (reg.status !== "ACTIVE") return new Response("This ticket was cancelled.", { status: 410 });
  return NextResponse.redirect(googleWalletSaveUrl(reg.event, reg), 302);
}
