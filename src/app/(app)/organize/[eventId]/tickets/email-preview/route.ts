import { getCurrentUser } from "@/lib/dal";
import { eventAccessOrNull } from "@/lib/organizer";
import QRCode from "qrcode";
import { qrUrl, renderTicketEmail, ticketUrl } from "@/lib/tickets";

/** What attendees get: the ticket email for this event, filled with a sample attendee. */
export async function GET(_request: Request, { params }: RouteContext<"/organize/[eventId]/tickets/email-preview">) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  const access = user && (await eventAccessOrNull(user, eventId, "ORGANIZER"));
  if (!user || !access) return new Response("Not found", { status: 404 });
  const sample = "preview-sample-ticket";
  const { html } = renderTicketEmail(access.event, { code: sample, name: "Alex Example", email: "alex@example.com", ticketType: { name: "General admission" } });
  // The sample ticket doesn't exist, so draw its QR code inline instead of linking to it.
  const qr = await QRCode.toDataURL(ticketUrl(sample), { width: 440, margin: 2 });
  return new Response(html.replace(qrUrl(sample), qr), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}
