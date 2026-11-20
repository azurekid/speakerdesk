import "server-only";
import { prisma } from "@/lib/db";

export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  done: boolean;
  required: boolean;
  href?: string; // where to complete it (when not inline)
  cta?: string;
};

/** The onboarding checklist adapts to what the person told us they're here for. */
export async function getOnboarding(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      emailVerified: true, primaryRole: true, termsAcceptedAt: true, onboardedAt: true,
      profile: true,
      sponsorOrg: { select: { id: true, _count: { select: { sponsorships: true } } } },
      accounts: { select: { providerId: true, password: true } },
      _count: { select: { talks: true, eventMemberships: true } },
    },
  });
  const p = user.profile;
  const detailsDone = Boolean(p?.fullName && p.country && p.timezone && user.termsAcceptedAt);
  const steps: OnboardingStep[] = [
    { id: "details", title: "Your personal details", description: "Your name, where you're based and what brings you here.", done: detailsDone, required: true },
    { id: "verify", title: "Verify your email", description: "So we know codes and notifications reach you.", done: user.emailVerified, required: true },
  ];

  if (user.primaryRole === "SPEAKER") {
    steps.push(
      { id: "photo-bio", title: "Add a photo and a short bio", description: "Organizers see these with every proposal.", done: Boolean(p?.headshotSquareUrl && p.bioShort), required: true, href: "/profile", cta: "Open profile" },
      { id: "first-session", title: "Add your first session", description: "Write it once, reuse it for every call for papers.", done: user._count.talks > 0, required: true, href: "/sessions/new", cta: "Add a session" },
      { id: "public-page", title: "Publish your speaker page", description: "Let organizers find you and invite you.", done: Boolean(p?.publicProfile), required: false, href: "/profile", cta: "Set up page" },
    );
  } else if (user.primaryRole === "ORGANIZER") {
    const managed = await prisma.eventMember.findMany({ where: { userId, role: { in: ["OWNER", "ORGANIZER"] } }, select: { eventId: true } });
    const teamSize = managed.length
      ? await prisma.eventMember.count({ where: { eventId: { in: managed.map((m) => m.eventId) }, NOT: { userId } } }) +
        (await prisma.eventInvite.count({ where: { eventId: { in: managed.map((m) => m.eventId) } } }))
      : 0;
    steps.push(
      { id: "first-event", title: "Create your first event", description: "Dates, venue and the call for papers.", done: user._count.eventMemberships > 0, required: true, href: "/organize/new", cta: "Create event" },
      { id: "invite-team", title: "Invite your team", description: "Co-organizers, reviewers and volunteers.", done: teamSize > 0, required: false, href: managed[0] ? `/organize/${managed[0].eventId}/team` : "/organize", cta: "Invite people" },
    );
  } else {
    steps.push(
      { id: "company", title: "Add your company profile", description: "Organizers see it with every sponsorship request.", done: Boolean(user.sponsorOrg), required: true, href: "/sponsor/company", cta: "Add company" },
      { id: "first-request", title: "Find an event to sponsor", description: "Browse prospectuses and request a package.", done: (user.sponsorOrg?._count.sponsorships ?? 0) > 0, required: false, href: "/sponsor", cta: "Browse events" },
    );
  }

  const hasPassword = user.accounts.some((a) => (a.providerId === "credential" && a.password) || a.providerId !== "credential");
  steps.push({ id: "secure", title: "Choose how you sign in", description: "Add a password if you'd rather not use email codes.", done: hasPassword, required: false, href: "/account", cta: "Account settings" });

  const required = steps.filter((s) => s.required);
  return {
    steps,
    role: user.primaryRole,
    profile: p,
    termsAcceptedAt: user.termsAcceptedAt,
    onboardedAt: user.onboardedAt,
    done: steps.filter((s) => s.done).length,
    requiredDone: required.every((s) => s.done),
    requiredLeft: required.filter((s) => !s.done).length,
  };
}
