import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Public pages are crawlable; signed-in areas and APIs are not worth indexing. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/", "/admin", "/dashboard", "/organize", "/profile", "/sessions", "/submissions", "/import", "/export",
        "/sponsor", "/invitations", "/welcome", "/onboarding", "/account", "/badges", "/goodbye", "/verify-email", "/tickets/", "/invite/", "/events/*/submit",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
