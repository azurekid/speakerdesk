import "server-only";
import { prisma } from "@/lib/db";

/** All distinct tags this user has used, most frequent first. */
export async function getTagSuggestions(userId: string): Promise<string[]> {
  const talks = await prisma.talk.findMany({ where: { userId }, select: { tags: true } });
  const counts = new Map<string, number>();
  for (const t of talks) for (const tag of t.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
}
