import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/form-controls";
import { ButtonLink, Logo, Skeleton } from "@/components/ui";
import { acceptInvite } from "@/lib/actions/team";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Team invitation" };

type Props = PageProps<"/invite/[token]">;

export default function InvitePage(props: Props) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden lg:block">
        <Image src="/images/events/panel.jpg" alt="A panel discussion on stage" fill priority sizes="50vw" className="object-cover" />
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-10 block"><Logo /></Link>
          <Suspense fallback={<Skeleton rows={2} />}>
            <Invite params={props.params} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}

async function Invite({ params }: { params: Props["params"] }) {
  const { token } = await params;
  const invite = await prisma.eventInvite.findUnique({ where: { token }, include: { event: true, invitedBy: { select: { name: true } } } });
  const user = await getCurrentUser();

  if (!invite || invite.expiresAt < new Date()) {
    return <Message title="This invite has expired">Ask the organizer for a new link.</Message>;
  }
  if (invite.acceptedAt) {
    return <Message title="Invite already used" action={<ButtonLink href={`/organize/${invite.eventId}`}>Open the event</ButtonLink>}>You&apos;re on the team.</Message>;
  }
  const intro = (
    <>
      <p className="text-sm font-medium text-brand-600">You&apos;re invited</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Join {invite.event.name}</h1>
      <p className="mt-2 text-ink-soft">
        {invite.invitedBy?.name ?? "An organizer"} invited <span className="font-medium text-ink">{invite.email}</span> as{" "}
        <span className="font-medium text-ink">{ROLE_LABELS[invite.role].toLowerCase()}</span>{invite.title && ` (${invite.title})`}.
      </p>
      <p className="mt-1 text-sm text-ink-soft">{ROLE_DESCRIPTIONS[invite.role]}</p>
    </>
  );
  if (!user) {
    const next = encodeURIComponent(`/invite/${token}`);
    return (
      <>
        {intro}
        <div className="mt-8 flex gap-2">
          <ButtonLink href={`/sign-in?next=${next}`}>Sign in or create an account</ButtonLink>
        </div>
        <p className="mt-3 text-xs text-ink-soft">Use {invite.email} — new accounts with that address join the team automatically.</p>
      </>
    );
  }
  if (user.email.toLowerCase() !== invite.email) {
    return (
      <>
        {intro}
        <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You&apos;re signed in as {user.email}. This invite only works for {invite.email} — sign in with that address, or ask for an invite to this one.
        </p>
      </>
    );
  }
  return (
    <>
      {intro}
      <div className="mt-8">
        <ActionButton action={acceptInvite.bind(null, token)} variant="accent">Join the team</ActionButton>
      </div>
    </>
  );
}

function Message({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-ink-soft">{children}</p>
      {action && <div className="mt-6">{action}</div>}
    </>
  );
}
