import {
  Award, ClipboardCheck, Crown, Flame, HeartHandshake, Lightbulb, type LucideIcon, Medal, Megaphone, Mic, Rocket, Sparkles, Star, Ticket, Trophy, Users, Wrench,
} from "lucide-react";
import { BADGE_COLORS, type BadgeIcon, isBadgeColor, isBadgeIcon } from "@/lib/badges";
import { cx } from "@/components/ui";

const ICONS: Record<BadgeIcon, LucideIcon> = {
  award: Award, mic: Mic, crown: Crown, wrench: Wrench, sparkles: Sparkles, users: Users, star: Star, megaphone: Megaphone,
  heart: HeartHandshake, ticket: Ticket, clipboard: ClipboardCheck, trophy: Trophy, rocket: Rocket, lightbulb: Lightbulb, medal: Medal, flame: Flame,
};

const SIZES = { sm: { box: "size-10", icon: "size-5", ring: 2 }, md: { box: "size-16", icon: "size-7", ring: 3 }, lg: { box: "size-32", icon: "size-14", ring: 5 } } as const;

/** A round medal for a badge. Same colours in light and dark mode, so it reads like an object. */
export function BadgeMedal({ icon, color, size = "md", muted = false, className }: { icon: string; color: string; size?: keyof typeof SIZES; muted?: boolean; className?: string }) {
  const c = BADGE_COLORS[isBadgeColor(color) ? color : "brand"];
  const Icon = ICONS[isBadgeIcon(icon) ? icon : "award"];
  const s = SIZES[size];
  return (
    <span
      aria-hidden
      className={cx("inline-grid shrink-0 place-items-center rounded-full", s.box, muted && "opacity-50 grayscale", className)}
      style={{ background: c.fill, boxShadow: `inset 0 0 0 ${s.ring}px ${c.ring}`, color: c.ink }}
    >
      <Icon className={s.icon} strokeWidth={1.75} />
    </span>
  );
}
