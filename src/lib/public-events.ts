import "server-only";
import { connection } from "next/server";
import { prisma } from "@/lib/db";

/** Events with a published CfP that hasn't closed yet, soonest deadline first. */
export async function getOpenCalls(limit = 12) {
  await connection(); // "open" depends on today's date, so never prerender this
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return prisma.event.findMany({
    where: { cfpPublished: true, OR: [{ cfpClosesAt: null }, { cfpClosesAt: { gte: today } }] },
    orderBy: [{ cfpClosesAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: limit,
  });
}

/**
 * Every published event that isn't an open call any more: CfPs that have closed, and events
 * whose programme is published without a CfP. Newest first. Linked from /events so search
 * engines can crawl each event page, not just the open ones.
 */
export async function getPastEvents(limit = 200) {
  await connection();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return prisma.event.findMany({
    where: {
      OR: [
        { cfpPublished: true, cfpClosesAt: { lt: today } },
        { cfpPublished: false, programPublished: true },
      ],
    },
    orderBy: [{ startDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: limit,
  });
}
