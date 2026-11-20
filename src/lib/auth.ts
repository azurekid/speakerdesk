import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, emailOTP } from "better-auth/plugins";
import { emailPasswordEnabled, enabledSocialProviders } from "@/lib/auth-providers";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { consume, throttleEmail } from "@/lib/rate-limit";
import { claimInvites } from "@/lib/team";

function social() {
  const env = process.env;
  const providers: Record<string, unknown> = {};
  const enabled = enabledSocialProviders();
  if (enabled.includes("github"))
    providers.github = { clientId: env.GITHUB_CLIENT_ID!, clientSecret: env.GITHUB_CLIENT_SECRET! };
  if (enabled.includes("google"))
    providers.google = { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! };
  if (enabled.includes("linkedin"))
    providers.linkedin = { clientId: env.LINKEDIN_CLIENT_ID!, clientSecret: env.LINKEDIN_CLIENT_SECRET! };
  if (enabled.includes("microsoft"))
    providers.microsoft = {
      clientId: env.MICROSOFT_CLIENT_ID!,
      clientSecret: env.MICROSOFT_CLIENT_SECRET!,
      tenantId: env.MICROSOFT_TENANT_ID || "common",
    };
  return providers;
}

/** Emails listed in ADMIN_EMAILS become platform admins (bootstrap for a fresh deployment). */
export const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

const OTP_COPY = {
  "sign-in": { subject: "Your SpeakerDesk sign-in code", line: "Use this code to sign in" },
  "email-verification": { subject: "Verify your email for SpeakerDesk", line: "Use this code to verify your email address" },
  "forget-password": { subject: "Reset your SpeakerDesk password", line: "Use this code to choose a new password" },
  "change-email": { subject: "Confirm your new email for SpeakerDesk", line: "Use this code to confirm your new email address" },
} as const;

/** Rate limits are on in production; AUTH_RATE_LIMIT=true|false overrides (e.g. to test them locally). */
const rateLimitEnabled = process.env.AUTH_RATE_LIMIT
  ? process.env.AUTH_RATE_LIMIT.toLowerCase() === "true"
  : process.env.NODE_ENV === "production";

export const auth = betterAuth({
  // Build (e.g. in Docker) has no secrets; runtime without BETTER_AUTH_SECRET fails in production as it should.
  secret: process.env.BETTER_AUTH_SECRET || (process.env.NEXT_PHASE === "phase-production-build" ? "build-time-placeholder-never-used-at-runtime" : undefined),
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: emailPasswordEnabled(), minPasswordLength: 10 },
  socialProviders: social(),
  // Per-IP limits, stored in Postgres so all replicas share one count.
  // The emailOTP plugin adds 3/min on its send and verify endpoints.
  rateLimit: {
    enabled: rateLimitEnabled,
    customStorage: { consume },
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-in/email-otp": { window: 60, max: 5 },
    },
  },
  // Per-email limits across all IPs — see src/lib/rate-limit.ts.
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (!rateLimitEnabled) return;
      const { allowed, retryAfter } = await throttleEmail(ctx.path, (ctx.body as { email?: unknown } | undefined)?.email);
      if (!allowed) {
        throw new APIError(
          "TOO_MANY_REQUESTS",
          { message: "Too many attempts for this email address. Please wait a while and try again." },
          { "Retry-After": String(retryAfter ?? 60) },
        );
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Passcode sign-ups arrive without a name: start from the email until onboarding asks for it.
          const name = user.name?.trim() || user.email.split("@")[0];
          const role = adminEmails().includes(user.email.toLowerCase()) ? "admin" : undefined;
          return { data: { ...user, name, ...(role ? { role } : {}) } };
        },
        // Every user gets an (empty) profile seeded from their sign-up name.
        after: async (user) => {
          await prisma.speakerProfile.upsert({
            where: { userId: user.id },
            create: { userId: user.id, fullName: user.name ?? "" },
            update: {},
          });
          // Join any event teams this email was invited to before the account existed.
          await claimInvites(user.id, user.email);
        },
      },
    },
  },
  plugins: [
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    // Passcode sign-in, email verification, password reset and email change — all by 6-digit code.
    emailOTP({
      // Codes only sign in existing accounts. For unknown emails the send endpoint still answers
      // "success" without sending anything, so it can't be used to discover who has an account.
      disableSignUp: true,
      otpLength: 6,
      expiresIn: 10 * 60,
      allowedAttempts: 5,
      changeEmail: { enabled: true },
      async sendVerificationOTP({ email, otp, type }) {
        const copy = OTP_COPY[type];
        await sendMail({
          to: email,
          subject: copy.subject,
          kind: type,
          sensitive: true,
          text: `${copy.line}:\n\n    ${otp}\n\nIt expires in 10 minutes. If you didn't ask for this, you can ignore this email.\n\n— SpeakerDesk`,
        });
      },
    }),
    nextCookies(), // must stay last
  ],
});
