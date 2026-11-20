import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * `next build` (e.g. inside Docker) imports route modules but never queries the database,
 * so a placeholder is fine there. At runtime a missing DATABASE_URL fails loudly.
 */
function connectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.NEXT_PHASE === "phase-production-build") return "postgresql://build:build@localhost:5432/build";
  throw new Error("DATABASE_URL is not set");
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString() }) });

// One client per process (also survives hot reloads in development).
globalForPrisma.prisma = prisma;
