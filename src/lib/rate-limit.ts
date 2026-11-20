import "server-only";
import { prismaBase as prisma } from "@/lib/db";

export type RateLimitRule = { window: number; max: number }; // window in seconds

/**
 * Atomically counts one hit against `key` in a fixed window and says whether it's allowed.
 * One SQL statement, so concurrent requests on different replicas can't all slip through.
 */
export async function consume(key: string, rule: RateLimitRule): Promise<{ allowed: boolean; retryAfter: number | null }> {
  if (Math.random() < 0.002) void pruneRateLimits().catch(() => {});
  const now = Date.now();
  const windowMs = rule.window * 1000;
  const [row] = await prisma.$queryRaw<{ count: number; windowStart: bigint }[]>`
    INSERT INTO rate_limit ("key", "count", "windowStart") VALUES (${key}, 1, ${BigInt(now)})
    ON CONFLICT ("key") DO UPDATE SET
      "count"       = CASE WHEN rate_limit."windowStart" <= ${BigInt(now - windowMs)} THEN 1 ELSE rate_limit."count" + 1 END,
      "windowStart" = CASE WHEN rate_limit."windowStart" <= ${BigInt(now - windowMs)} THEN ${BigInt(now)} ELSE rate_limit."windowStart" END
    RETURNING "count", "windowStart"`;
  if (row.count <= rule.max) return { allowed: true, retryAfter: null };
  return { allowed: false, retryAfter: Math.max(1, Math.ceil((Number(row.windowStart) + windowMs - now) / 1000)) };
}

/**
 * Per-account limits, on top of Better Auth's per-IP limits, so an attacker spreading guesses
 * over many IPs still gets only a handful of tries per email address.
 *
 * They count every request for the address whether or not an account exists, so a 429 never
 * reveals which emails are registered.
 */
const EMAIL_RULES: { paths: string[]; bucket: string; rule: RateLimitRule }[] = [
  // Asking for a code: sign-in, email verification, password reset.
  { paths: ["/email-otp/send-verification-otp", "/email-otp/request-password-reset", "/forget-password/email-otp"], bucket: "otp-send", rule: { window: 60 * 60, max: 5 } },
  // Entering a code. Each code also dies after 5 wrong tries (emailOTP allowedAttempts).
  { paths: ["/sign-in/email-otp", "/email-otp/verify-email", "/email-otp/check-verification-otp", "/email-otp/reset-password"], bucket: "otp-verify", rule: { window: 60 * 60, max: 10 } },
  // Password guessing against one account.
  { paths: ["/sign-in/email"], bucket: "password", rule: { window: 15 * 60, max: 10 } },
];

export async function throttleEmail(path: string, email: unknown): Promise<{ allowed: boolean; retryAfter: number | null }> {
  const match = EMAIL_RULES.find((r) => r.paths.includes(path));
  if (!match || typeof email !== "string" || !email) return { allowed: true, retryAfter: null };
  return consume(`email:${match.bucket}:${email.trim().toLowerCase()}`, match.rule);
}

/** Old counters are useless after their window; prune occasionally so the table stays small. */
export async function pruneRateLimits(olderThanMs = 24 * 60 * 60 * 1000) {
  await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: BigInt(Date.now() - olderThanMs) } } });
}
