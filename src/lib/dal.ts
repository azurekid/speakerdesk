import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
  impersonatedBy: string | null;
};

/** Reads the session once per request. Returns null when signed out. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, email, image, emailVerified, role } = session.user;
  return {
    id, name, email, image: image ?? null, emailVerified,
    isAdmin: role === "admin",
    impersonatedBy: (session.session as { impersonatedBy?: string | null }).impersonatedBy ?? null,
  };
});

/** Use in every page, route handler and server action that touches user data. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** Returns the speaker profile, creating an empty one if it is missing. */
export async function getOrCreateProfile(user: CurrentUser) {
  return prisma.speakerProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, fullName: user.name },
    update: {},
  });
}

export type PrimaryRole = "SPEAKER" | "ORGANIZER" | "SPONSOR";

/** The user's preferred side of the app (decides home page and nav order). */
export const getPrimaryRole = cache(async (userId: string): Promise<PrimaryRole> => {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { primaryRole: true } });
  return row?.primaryRole ?? "SPEAKER";
});

/** Platform admins only. Non-admins get a 404 so the admin area isn't discoverable. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) notFound();
  return user;
}
