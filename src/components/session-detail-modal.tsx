"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { cx } from "@/components/ui";
import { SpeakerSocialLinks } from "@/components/speaker-social-links";
import { LEVEL_LABELS, FORMAT_LABELS } from "@/lib/domain";
import type { Proposal } from "@prisma/client";

export interface SessionWithDetails extends Proposal {
  speaker: { name: string; profile: { fullName: string; tagline: string; headshotSquareUrl: string; websiteUrl: string } | null };
  room?: { name: string } | null;
}

export function SessionDetailModal({
  session,
  eventName,
  eventSlug,
  onClose,
}: {
  session: SessionWithDetails;
  eventName: string;
  eventSlug: string;
  onClose: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const p = session.speaker.profile;

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 transition-opacity" onClick={() => { setIsOpen(false); onClose(); }} />
      <div className="fixed inset-4 z-50 overflow-y-auto rounded-2xl bg-white sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-h-[80vh] sm:w-full sm:max-w-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-surface px-6 py-4">
          <h2 className="font-display text-lg font-semibold">{session.title}</h2>
          <button
            type="button"
            onClick={() => { setIsOpen(false); onClose(); }}
            className="rounded-lg p-1 hover:bg-neutral-100"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          {/* Speaker section */}
          <div className="flex gap-4">
            {p?.headshotSquareUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.headshotSquareUrl} alt="" className="size-16 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="grid size-16 shrink-0 place-items-center rounded-full bg-neutral-200 font-display text-xl font-semibold">{(p?.fullName || session.speaker.name)[0]}</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{p?.fullName || session.speaker.name}</p>
              {p?.tagline && <p className="text-sm text-ink-soft">{p.tagline}</p>}
              <SpeakerSocialLinks profile={p} className="mt-2" />
            </div>
          </div>

          {/* Session details */}
          <div>
            <p className="text-xs font-medium text-brand-700">
              {[session.track, FORMAT_LABELS[session.format], `${session.durationMinutes} min`, LEVEL_LABELS[session.level]].filter(Boolean).join(" · ")}
            </p>
            {session.room && <p className="mt-1 text-sm text-ink-soft">Room: {session.room.name}</p>}
          </div>

          {/* Abstract */}
          {session.abstract && (
            <div>
              <h3 className="font-semibold">About this session</h3>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed text-ink-soft">{session.abstract}</p>
            </div>
          )}

          {/* Speaker bio */}
          {p?.bioShort && (
            <div>
              <h3 className="font-semibold">About the speaker</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{p.bioShort}</p>
            </div>
          )}

          {/* Close button */}
          <div className="flex justify-end gap-3 border-t border-line pt-6">
            <button
              type="button"
              onClick={() => { setIsOpen(false); onClose(); }}
              className="rounded-lg bg-surface px-4 py-2 font-medium hover:bg-neutral-100"
            >
              Close
            </button>
            <a
              href={`/events/${eventSlug}#session-${session.id}`}
              onClick={() => { setIsOpen(false); onClose(); }}
              className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:brightness-110"
            >
              View in programme
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
