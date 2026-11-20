import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, emailOTP } from "better-auth/plugins";
import { emailPasswordEnabled, enabledSocialProviders } from "@/lib/auth-providers";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
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

export const auth = betterAuth({
  // Build (e.g. in Docker) has no secrets; runtime without BETTER_AUTH_SECRET fails in production as it should.
  secret: process.env.BETTER_AUTH_SECRET || (process.env.NEXT_PHASE === "phase-production-build" ? "build-time-placeholder-never-used-at-runtime" : undefined),
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: emailPasswordEnabled(), minPasswordLength: 10 },
  socialProviders: social(),
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
