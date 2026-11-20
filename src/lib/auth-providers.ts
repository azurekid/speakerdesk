import "server-only";

export type SocialProvider = "github" | "google" | "linkedin" | "microsoft";

const ENV_KEYS: Record<SocialProvider, [string, string]> = {
  github: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
  google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  linkedin: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
  microsoft: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
};

/** Providers whose client id + secret are both configured. */
export function enabledSocialProviders(): SocialProvider[] {
  return (Object.keys(ENV_KEYS) as SocialProvider[]).filter((p) =>
    ENV_KEYS[p].every((k) => Boolean(process.env[k])),
  );
}

/** Email + password: on by default in development, opt-in in production. */
export function emailPasswordEnabled(): boolean {
  const flag = process.env.AUTH_EMAIL_PASSWORD;
  if (flag !== undefined && flag !== "") return flag.toLowerCase() === "true";
  return process.env.NODE_ENV !== "production";
}
