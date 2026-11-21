import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/site";
import { RELEASES } from "@/lib/whats-new";

/**
 * Every public page: the fixed pages, each published event, each opted-in speaker page and
 * each badge a recipient chose to show. Built per request so new events appear right away.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const [events, speakers, badges] = await Promise.all([
    prisma.event.findMany({ where: { OR: [{ cfpPublished: true }, { programPublished: true }] }, select: { slug: true, updatedAt: true }, take: 5000 }),
    prisma.speakerProfile.findMany({ where: { publicProfile: true, slug: { not: null } }, select: { slug: true, updatedAt: true }, take: 10000 }),
    prisma.badgeAward.findMany({ where: { status: "ACCEPTED", showOnProfile: true }, select: { id: true, respondedAt: true }, take: 10000 }),
  ]);
  const page = (path: string, priority: number, changeFrequency: "daily" | "weekly" | "monthly" | "yearly", lastModified?: Date) => ({
    url: `${SITE_URL}${path}`, priority, changeFrequency, ...(lastModified ? { lastModified } : {}),
  });
  return [
    page("/", 1, "weekly"),
    page("/events", 0.9, "daily"),
    page("/speakers", 0.8, "daily"),
    page("/whats-new", 0.6, "weekly", new Date(`${RELEASES[0].date}T12:00:00Z`)),
    page("/sign-in", 0.5, "yearly"),
    page("/terms", 0.2, "yearly"),
    page("/privacy", 0.2, "yearly"),
    ...events.map((e) => page(`/events/${e.slug}`, 0.8, "daily", e.updatedAt)),
    ...speakers.map((s) => page(`/speakers/${s.slug}`, 0.6, "weekly", s.updatedAt)),
    ...badges.map((b) => page(`/credentials/${b.id}`, 0.3, "yearly", b.respondedAt ?? undefined)),
  ];
}
