import { audit } from "@/lib/audit";
import { toCsvTable, csvResponse } from "@/lib/csv";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { eventAccessOrNull } from "@/lib/organizer";

const FIELDS = {
  name: { header: "Name", value: (r: Row) => r.name },
  company: { header: "Company", value: (r: Row) => r.company },
  jobTitle: { header: "Job title", value: (r: Row) => r.jobTitle },
  email: { header: "Email", value: (r: Row) => r.email },
  ticket: { header: "Ticket", value: (r: Row) => r.ticketType?.name ?? "General admission" },
} as const;
type Row = { name: string; company: string; jobTitle: string; email: string; ticketType: { name: string } | null };

/**
 * The list an organizer hands to sponsors: only active attendees who agreed to sponsor contact
 * when they registered, minus anyone the organizer left out, with only the chosen columns.
 */
export async function GET(request: Request, { params }: RouteContext<"/organize/[eventId]/tickets/sponsor-leads.csv">) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  const access = user && (await eventAccessOrNull(user, eventId, "ORGANIZER"));
  if (!user || !access) return new Response("Not found", { status: 404 });
  const search = new URL(request.url).searchParams;
  const chosen = (Object.keys(FIELDS) as (keyof typeof FIELDS)[]).filter((f) => f === "name" || search.getAll("fields").includes(f));
  const checkedInOnly = search.get("checkedIn") === "1";
  const regs = await prisma.registration.findMany({
    where: { eventId, status: "ACTIVE", shareWithSponsors: true, excludeFromSponsorExport: false, ...(checkedInOnly ? { checkedInAt: { not: null } } : {}) },
    select: { name: true, company: true, jobTitle: true, email: true, ticketType: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  await audit({
    category: "data", action: "event.attendees.sponsor-export", targetType: "event", targetId: eventId,
    summary: `${regs.length} attendees with sponsor consent`, metadata: { fields: chosen, checkedInOnly },
  });
  return csvResponse(toCsvTable(chosen.map((f) => FIELDS[f].header), regs.map((r) => chosen.map((f) => FIELDS[f].value(r)))), `${access.event.slug}-sponsor-contacts.csv`);
}
