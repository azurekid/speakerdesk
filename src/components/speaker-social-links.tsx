"use client";

import { ExternalLink, Linkedin, Github, Mail, Youtube, type LucideIcon } from "lucide-react";
import type { SpeakerProfile } from "@prisma/client";

export function SpeakerSocialLinks({ profile, className = "" }: { profile: SpeakerProfile | null | undefined; className?: string }) {
  if (!profile) return null;

  type SocialLink = { url: string; label: string; icon: LucideIcon };
  const links: SocialLink[] = [
    ...(profile.linkedinUrl ? [{ url: profile.linkedinUrl, label: "LinkedIn", icon: Linkedin }] : []),
    ...(profile.githubUrl ? [{ url: profile.githubUrl, label: "GitHub", icon: Github }] : []),
    ...(profile.xUrl ? [{ url: profile.xUrl, label: "X", icon: ExternalLink }] : []),
    ...(profile.blueskyUrl ? [{ url: profile.blueskyUrl, label: "Bluesky", icon: ExternalLink }] : []),
    ...(profile.mastodonUrl ? [{ url: profile.mastodonUrl, label: "Mastodon", icon: ExternalLink }] : []),
    ...(profile.youtubeUrl ? [{ url: profile.youtubeUrl, label: "YouTube", icon: Youtube }] : []),
    ...(profile.sessionizeUrl ? [{ url: profile.sessionizeUrl, label: "Sessionize", icon: ExternalLink }] : []),
  ];

  if (!links.length) return null;

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {links.map(({ url, label, icon: Icon }) => (
        <a
          key={label}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={label}
          aria-label={label}
          className="text-ink-soft hover:text-brand-700 transition-colors"
        >
          <Icon className="size-4" />
        </a>
      ))}
    </div>
  );
}
