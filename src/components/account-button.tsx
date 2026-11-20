import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/dal";

const STYLES = {
  dark: "inline-flex min-h-10 items-center whitespace-nowrap rounded-lg bg-ink px-3.5 font-medium text-paper", // on the light public header
  light: "inline-flex min-h-10 items-center whitespace-nowrap rounded-lg bg-white px-3.5 font-medium text-night hover:bg-white/90", // on the photo hero
} as const;

type Variant = keyof typeof STYLES;

/**
 * "Sign in" for visitors, "Dashboard" for signed-in users.
 * Reading the session is request-time data, so it streams behind Suspense and the page shell stays prerendered.
 * The fallback is a same-sized blank pill, so signed-in users never see a flash of "Sign in".
 */
export function AccountButton({ variant = "dark" }: { variant?: Variant }) {
  return (
    <Suspense fallback={<span aria-hidden className={`${STYLES[variant]} invisible`}>Dashboard</span>}>
      <AccountLink variant={variant} />
    </Suspense>
  );
}

async function AccountLink({ variant }: { variant: Variant }) {
  const user = await getCurrentUser();
  return user ? (
    // The post-login router sends each user to their own home (speaker, organizer or sponsor).
    <Link href="/api/account/continue" prefetch={false} className={STYLES[variant]}>Dashboard</Link>
  ) : (
    <Link href="/sign-in" className={STYLES[variant]}>Sign in</Link>
  );
}
