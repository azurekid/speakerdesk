import "server-only";
import { connection } from "next/server";
import { prisma } from "@/lib/db";

/** Only the fields a speaker chose to make public — never email, travel or logistics. */
export const PUBLIC_PROFILE_SELECT = {
  userId: true, slug: true, fullName: true, tagline: true, pronouns: true, company: true, jobTitle: true,
  bioShort: true, bioMedium: true, bioLong: true, headshotSquareUrl: true, city: true, country: true,
  websiteUrl: true, linkedinUrl: true, githubUrl: true, xUrl: true, blueskyUrl: true, mastodonUrl: true, youtubeUrl: true,
  openToInvites: true, availabilityNote: true, topics: true,
} as const;

export async function searchSpeakers(q: string, topic?: string) {
  await connection();
  const query = q.trim();
  const profiles = await prisma.speakerProfile.findMany({
    where: {
      publicProfile: true,
      slug: { not: null },
      ...(topic ? { topics: { has: topic } } : {}),
      ...(query
        ? {
            OR: [
              { fullName: { contains: query, mode: "insensitive" } },
              { tagline: { contains: query, mode: "insensitive" } },
              { topics: { has: query.toLowerCase() } },
              { user: { talks: { some: { published: true, OR: [{ title: { contains: query, mode: "insensitive" } }, { tags: { has: query.toLowerCase() } }] } } } },
            ],
          }
        : {}),
    },
    select: { ...PUBLIC_PROFILE_SELECT, user: { select: { talks: { where: { published: true, archived: false }, select: { id: true, title: true } } } } },
    orderBy: { updatedAt: "desc" },
    take: 60,
  });
  return profiles;
}

export async function popularTopics() {
  const rows = await prisma.speakerProfile.findMany({ where: { publicProfile: true }, select: { topics: true } });
  const counts = new Map<string, number>();
  for (const r of rows) for (const t of r.topics) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([t]) => t);
}
