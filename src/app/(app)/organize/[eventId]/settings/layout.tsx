import { Suspense } from "react";
import { SetupSteps } from "@/components/organizer/setup-steps";
import { Skeleton } from "@/components/ui";
import { prisma } from "@/lib/db";
import { COVER_IMAGES } from "@/lib/domain";
import { requireEventAccess } from "@/lib/organizer";
import { canAdmin } from "@/lib/permissions";

/** Event setup: a list of steps on the left, one step's form on the right. */
export default function SettingsLayout({ children, params }: LayoutProps<"/organize/[eventId]/settings">) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
      <Suspense fallback={<Skeleton rows={5} />}>
        <Steps params={params} />
      </Suspense>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

async function Steps({ params }: { params: LayoutProps<"/organize/[eventId]/settings">["params"] }) {
  const { eventId } = await params;
  const { event, role } = await requireEventAccess(eventId, "ORGANIZER");
  const ticketTypes = await prisma.ticketType.count({ where: { eventId } });
  const done = {
    details: Boolean(event.startDate && event.description.trim() && (event.format === "ONLINE" || event.venue || event.location)),
    cover: event.coverImage !== COVER_IMAGES[0].src,
    cfp: Boolean(event.cfpClosesAt && (event.tracks.length || event.formats.length || event.cfpGuidelines.trim())),
    registration: event.registrationOpen || ticketTypes > 0,
    emails: true, // built-in emails work out of the box
  };
  return <SetupSteps eventId={eventId} done={done} owner={canAdmin(role)} />;
}
