import Image from "next/image";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import {
  type CfpState, CFP_STATE_LABELS, DECISION_STYLES, type Decision, FORMAT_LABELS, STATUS_LABELS, STATUS_STYLES,
  type SubmissionStatus, type TalkFormat,
} from "@/lib/domain";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const BUTTON = {
  primary: "bg-ink text-paper",
  accent: "bg-brand-600 text-white hover:brightness-110",
  secondary: "bg-surface text-ink ring-1 ring-inset ring-line shadow-[0_1px_2px_rgb(0_0_0/0.04)] hover:bg-neutral-50",
  ghost: "text-ink-soft hover:bg-neutral-100 hover:text-ink",
  danger: "bg-surface text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-50",
  light: "bg-white/95 text-night hover:bg-white",
} as const;
export type ButtonVariant = keyof typeof BUTTON;

export function buttonClass(variant: ButtonVariant = "primary", size: "sm" | "md" | "lg" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-60 disabled:pointer-events-none",
    size === "sm" ? "px-2.5 py-1.5 text-xs" : size === "lg" ? "px-5 py-3 text-base" : "px-3.5 py-2 text-sm",
    BUTTON[variant],
  );
}

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  return <Link {...props} className={cx(buttonClass(variant, size), className)} />;
}

export function Logo({ light = false, className }: { light?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 text-[17px] font-semibold tracking-tight", light ? "text-white" : "text-ink", className)}>
      <span className="grid size-6 place-items-center rounded-md bg-brand-500 text-[13px] font-bold text-white">S</span>
      SpeakerDesk
    </span>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-sm font-medium text-brand-600", className)}>{children}</p>;
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 text-sm text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A full-bleed event photo with text set on a bottom scrim. */
export function PhotoBanner({ src, children, className, priority, fit, position }: { src: string; children: ReactNode; className?: string; priority?: boolean; fit?: string; position?: string }) {
  return (
    <section className={cx("relative isolate overflow-hidden rounded-2xl bg-night text-white", className)}>
      <CoverImage src={src} priority={priority} fit={fit} position={position} className="absolute inset-0 -z-10 size-full" sizes="(min-width: 1024px) 1024px, 100vw" />
      <div className="photo-scrim absolute inset-0 -z-10" />
      {children}
    </section>
  );
}

const FIT_CLASS = { cover: "object-cover", contain: "object-contain" } as const;
const POSITION_CLASS = { top: "object-top", center: "object-center", bottom: "object-bottom" } as const;

/**
 * An event cover. Bundled photos go through next/image; organizer-supplied URLs render as plain <img>.
 * `fit`/`position` are the organizer's scaling choice: fill-and-crop with a focus, or show the whole image.
 * Put it in a container with a background (e.g. bg-night) so "contain" letterboxing looks deliberate.
 */
export function CoverImage({ src, className, sizes, priority, alt = "", fit = "cover", position = "center" }: {
  src: string; className?: string; sizes?: string; priority?: boolean; alt?: string; fit?: string; position?: string;
}) {
  const cls = cx(FIT_CLASS[fit as keyof typeof FIT_CLASS] ?? "object-cover", POSITION_CLASS[position as keyof typeof POSITION_CLASS] ?? "object-center", className);
  if (src.startsWith("/")) return <Image src={src} alt={alt} fill sizes={sizes ?? "100vw"} priority={priority} className={cls} />;
  // eslint-disable-next-line @next/next/no-img-element -- arbitrary organizer-provided hosts
  return <img src={src} alt={alt} className={cls} />;
}

export function Card({ title, description, actions, children, className }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("min-w-0 rounded-2xl border border-line bg-surface", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-4 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="font-display tracking-tight text-lg font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-ink-soft">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", className ?? "bg-neutral-50 text-ink-soft ring-line")}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  return (
    <Badge className={STATUS_STYLES[status]}>
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function DecisionBadge({ decision }: { decision: Decision }) {
  const label = { UNDECIDED: "Undecided", ACCEPTED: "Accepted", WAITLISTED: "Waitlisted", REJECTED: "Rejected" }[decision];
  return <Badge className={DECISION_STYLES[decision]}>{label}</Badge>;
}

export function CfpBadge({ state }: { state: CfpState }) {
  const style = {
    draft: "bg-neutral-100 text-neutral-600 ring-neutral-200",
    upcoming: "bg-amber-50 text-amber-800 ring-amber-200",
    open: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    closed: "bg-neutral-100 text-neutral-600 ring-neutral-200",
  }[state];
  return <Badge className={style}>{state === "open" && <span className="size-1.5 rounded-full bg-current" />}{CFP_STATE_LABELS[state]}</Badge>;
}

/** Muted per-format accent, used as a thin rule on cards. */
export const FORMAT_COLORS: Record<TalkFormat, { badge: string; stripe: string }> = {
  SESSION: { badge: "bg-neutral-50 text-ink ring-line", stripe: "bg-ink" },
  WORKSHOP: { badge: "bg-amber-50 text-amber-900 ring-amber-200", stripe: "bg-amber-600" },
  LIGHTNING_TALK: { badge: "bg-yellow-50 text-yellow-900 ring-yellow-200", stripe: "bg-yellow-500" },
  PANEL: { badge: "bg-sky-50 text-sky-900 ring-sky-200", stripe: "bg-sky-700" },
  KEYNOTE: { badge: "bg-brand-50 text-brand-700 ring-brand-200", stripe: "bg-brand-600" },
  OTHER: { badge: "bg-neutral-50 text-ink-soft ring-line", stripe: "bg-neutral-400" },
};

export function FormatBadge({ format }: { format: TalkFormat }) {
  return <Badge className={FORMAT_COLORS[format].badge}>{FORMAT_LABELS[format]}</Badge>;
}

export function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1">
      {tags.map((t) => (
        <span key={t} className="text-xs text-ink-soft">#{t}</span>
      ))}
    </div>
  );
}

export function EmptyState({ title, children, action, photo }: { title: string; children?: ReactNode; action?: ReactNode; photo?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface md:grid md:grid-cols-[1fr_280px]">
      <div className="px-8 py-12">
        <h3 className="font-display tracking-tight text-2xl font-semibold text-ink">{title}</h3>
        {children && <p className="mt-2 max-w-md text-sm text-ink-soft">{children}</p>}
        {action && <div className="mt-6">{action}</div>}
      </div>
      {photo && (
        <div className="relative hidden md:block">
          <CoverImage src={photo} sizes="280px" className="object-cover" />
        </div>
      )}
    </div>
  );
}

export function Field({ label, htmlFor, hint, error, children, className }: { label: string; htmlFor?: string; hint?: ReactNode; error?: string[]; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-ink">{label}</label>
      {children}
      {error?.length ? <p className="mt-1 text-xs text-rose-700">{error[0]}</p> : hint ? <p className="mt-1 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-20 rounded-lg bg-neutral-200/60" />
      ))}
    </div>
  );
}

export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cx("text-brand-700 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-700", className)}>
      {children}
    </a>
  );
}

/** "MAY" / "10" parts for date blocks (UTC, date-only). */
export function dateParts(d: Date) {
  return {
    month: new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(d).toUpperCase(),
    day: new Intl.DateTimeFormat("en", { day: "numeric", timeZone: "UTC" }).format(d),
    weekday: new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(d),
  };
}

// Date formatting lives in src/lib/dates.ts (also used by server code and emails).
export { formatDate, formatDateRange } from "@/lib/dates";

export function toDateInput(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}
