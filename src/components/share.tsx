"use client";

import { Check, Link2, Mail, Share2 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type ShareProps = {
  /** Absolute URL of the page (or page#anchor) being shared. */
  url: string;
  /** Short line used as the post text, e.g. "Call for papers open: DevConf 2027". */
  text: string;
  /** Email subject; defaults to `text`. */
  subject?: string;
};

/**
 * Plain share links — no third-party scripts or tracking pixels, so nothing loads from the
 * networks until someone actually clicks. Mastodon has no central share URL, so it's covered
 * by copy link and the phone's own share sheet.
 */
function targets({ url, text }: ShareProps) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return [
    { id: "linkedin", label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { id: "x", label: "X", href: `https://x.com/intent/post?text=${t}&url=${u}` },
    { id: "bluesky", label: "Bluesky", href: `https://bsky.app/intent/compose?text=${encodeURIComponent(`${text} ${url}`)}` },
    { id: "facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { id: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
  ];
}

function useCopy(url: string) {
  const [copied, setCopied] = useState(false);
  return [
    copied,
    async () => {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        window.prompt("Copy this link:", url);
      }
    },
  ] as const;
}

const noSubscribe = () => () => {};
/** Whether the browser has a native share sheet (phones, some desktops). False during SSR. */
function useNativeShare() {
  return useSyncExternalStore(noSubscribe, () => typeof navigator.share === "function", () => false);
}

const chipBase = "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm md:min-h-9";
const chip = `${chipBase} border-line bg-surface text-ink hover:border-neutral-400`;
// Its own class list (not an override of `chip`): conflicting utilities resolve by CSS order, not class order.
const chipPrimary = `${chipBase} border-ink bg-ink text-paper hover:opacity-90`;

/** A row of share buttons, for a page's main thing (an event). */
export function ShareButtons(props: ShareProps & { className?: string; title?: string }) {
  const [copied, copy] = useCopy(props.url);
  const native = useNativeShare();
  return (
    <div className={props.className}>
      {props.title && <p className="mb-2 text-sm font-medium text-ink">{props.title}</p>}
      <div className="flex flex-wrap gap-2">
        {native && (
          <button type="button" className={chipPrimary} onClick={() => navigator.share({ url: props.url, text: props.text, title: props.subject ?? props.text }).catch(() => {})}>
            <Share2 className="size-4" />Share…
          </button>
        )}
        {targets(props).map((s) => (
          <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer" className={chip}>{s.label}</a>
        ))}
        <a href={`mailto:?subject=${encodeURIComponent(props.subject ?? props.text)}&body=${encodeURIComponent(`${props.text}\n\n${props.url}`)}`} className={chip}>
          <Mail className="size-4" />Email
        </a>
        <button type="button" onClick={copy} className={chip} aria-live="polite">
          {copied ? <><Check className="size-4 text-emerald-600" />Copied</> : <><Link2 className="size-4" />Copy link</>}
        </button>
      </div>
    </div>
  );
}

/** A compact "Share" button with a dropdown, for items in a list (sessions, talks). */
export function ShareMenu(props: ShareProps & { label?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, copy] = useCopy(props.url);
  const native = useNativeShare();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const item = "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink hover:bg-neutral-100";
  return (
    <div ref={box} className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        // On phones, go straight to the system share sheet.
        onClick={() => (native ? navigator.share({ url: props.url, text: props.text, title: props.subject ?? props.text }).catch(() => {}) : setOpen((o) => !o))}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-soft hover:bg-neutral-100 hover:text-ink md:min-h-8"
      >
        <Share2 className="size-4" />{props.label ?? "Share"}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
          {targets(props).map((s) => (
            <a key={s.id} role="menuitem" href={s.href} target="_blank" rel="noopener noreferrer" className={item}>{s.label}</a>
          ))}
          <a role="menuitem" href={`mailto:?subject=${encodeURIComponent(props.subject ?? props.text)}&body=${encodeURIComponent(`${props.text}\n\n${props.url}`)}`} className={item}><Mail className="size-4" />Email</a>
          <button type="button" role="menuitem" onClick={copy} className={item}>{copied ? <><Check className="size-4 text-emerald-600" />Copied</> : <><Link2 className="size-4" />Copy link</>}</button>
        </div>
      )}
    </div>
  );
}
