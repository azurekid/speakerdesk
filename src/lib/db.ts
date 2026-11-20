import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prismaBase?: PrismaClient };

/**
 * `next build` (e.g. inside Docker) imports route modules but never queries the database,
 * so a placeholder is fine there. At runtime a missing DATABASE_URL fails loudly.
 */
function connectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.NEXT_PHASE === "phase-production-build") return "postgresql://build:build@localhost:5432/build";
  throw new Error("DATABASE_URL is not set");
}

/**
 * The raw client, without auditing. Only for Better Auth's adapter (its events are audited
 * through auth hooks) and for the audit writer itself. Application code uses `prisma`.
 */
export const prismaBase = globalForPrisma.prismaBase ?? new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString() }) });

// One client per process (also survives hot reloads in development).
globalForPrisma.prismaBase = prismaBase;

/** The application client: every create/update/delete is written to the audit log. */
export const prisma = prismaBase.$extends({
  name: "audit",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const result = await query(args);
        if (model && /^(create|update|upsert|delete)/.test(operation)) {
          // Imported lazily: audit.ts imports this module.
          const { auditDataChange, isAuditedMutation } = await import("@/lib/audit");
          if (isAuditedMutation(model, operation)) await auditDataChange(model, operation, args as Record<string, unknown>, result);
        }
        return result;
      },
    },
  },
});
