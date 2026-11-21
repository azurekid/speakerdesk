import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content Security Policy. Pages are prerendered (Cache Components), so per-request nonces
 * aren't possible; inline scripts stay allowed (Next.js streams data in them) but nothing can be
 * loaded from another site except images. See node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
 * - img-src https: headshots, sponsor logos and cover photos can come from any https host.
 * - frame-src: the OpenStreetMap venue map.
 * - frame-ancestors 'none': nobody can put SpeakerDesk in a frame (clickjacking).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "frame-src https://www.openstreetmap.org",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" }, // older browsers that ignore frame-ancestors
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera for the door check-in scanner, on our own pages only; everything else off.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Browsers ignore HSTS over plain http, so this is harmless on localhost.
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (Azure App Service / Container Apps).
  output: "standalone",
  // Don't advertise the framework (X-Powered-By).
  poweredByHeader: false,
  // Keep the dev badge away from the speaker badge in the bottom-left of the sidebar.
  devIndicators: { position: "bottom-right" },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
