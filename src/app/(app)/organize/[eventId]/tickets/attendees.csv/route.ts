import { audit } from "@/lib/audit";
import { toCsvTable, csvResponse } from "@/lib/csv";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { eventAccessOrNull } from "@/lib/organizer";

/** Everyone registered, for the organizers' own use. */
export async function GET(_request: Request, { params }: RouteContext<"/organize/[eventId]/tickets/attendees.csv">) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  const access = user && (await eventAccessOrNull(user, eventId, "ORGANIZER"));
  if (!user || !access) return new Response("Not found", { status: 404 });
  const regs = await prisma.registration.findMany({ where: { eventId }, include: { ticketType: { select: { name: true } } }, orderBy: { createdAt: "asc" } });
  await audit({ category: "data", action: "event.attendees.export", targetType: "event", targetId: eventId, summary: `${regs.length} attendees` });
  const body = toCsvTable(
    ["Name", "Email", "Company", "Job title", "Ticket", "Status", "Checked in", "Source", "Sponsor contact OK", "Registered"],
    regs.map((r) => [
      r.name, r.email, r.company, r.jobTitle, r.ticketType?.name ?? "General admission", r.status === "ACTIVE" ? "Active" : "Cancelled",
      r.checkedInAt?.toISOString() ?? "", r.source === "IMPORT" ? `Import (${r.sourcePlatform})` : r.source === "MANUAL" ? "Added by hand" : "Event page",
      r.shareWithSponsors ? "Yes" : "No", r.createdAt.toISOString(),
    ]),
  );
  return csvResponse(body, `${access.event.slug}-attendees.csv`);
}
