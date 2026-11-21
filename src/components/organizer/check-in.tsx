"use client";

import { Camera, CameraOff, Check, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { buttonClass, cx } from "@/components/ui";
import { type CheckInResult, checkIn, checkInById, undoCheckIn } from "@/lib/actions/tickets";

export type DoorAttendee = { id: string; name: string; email: string; company: string; ticket: string; checkedIn: boolean; cancelled: boolean };

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/** Green only for a fresh check-in; everything else (already used, cancelled, unknown) is red. */
const isGood = (r: CheckInResult) => r.status === "checked-in";

/** Camera + QR decoding. Uses BarcodeDetector where it exists (Chrome, Edge, Android) and jsQR elsewhere (Safari). */
function useScanner(active: boolean, onCode: (value: string) => void, onError: (message: string) => void) {
  const video = useRef<HTMLVideoElement>(null);
  const last = useRef<{ value: string; at: number } | null>(null);
  const handler = useRef(onCode);
  const errorHandler = useRef(onError);
  useEffect(() => {
    handler.current = onCode;
    errorHandler.current = onError;
  });
  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    const canvas = document.createElement("canvas");
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        errorHandler.current("No camera access. Allow the camera for this site in your browser settings, or search by name.");
        return;
      }
      if (stopped || !video.current) return stream.getTracks().forEach((t) => t.stop());
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      const detector = BD ? new BD({ formats: ["qr_code"] }) : null;
      const jsQR = detector ? null : (await import("jsqr")).default;
      timer = setInterval(async () => {
        const v = video.current;
        if (!v || v.readyState < 2) return;
        let value: string | null = null;
        if (detector) {
          value = (await detector.detect(v).catch(() => []))[0]?.rawValue ?? null;
        } else if (jsQR) {
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;
          ctx.drawImage(v, 0, 0);
          value = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data ?? null;
        }
        if (!value) return;
        // The same code stays in view for a while: only act on it once every 4 seconds.
        const now = Date.now();
        if (last.current && last.current.value === value && now - last.current.at < 4000) return;
        last.current = { value, at: now };
        handler.current(value);
      }, 250);
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active]);
  return video;
}

/**
 * The door. `fullScreen` is the dedicated scanner (/scan/[eventId]): the camera starts by itself
 * and each result fills the screen in green or red. Otherwise it's a panel in the workspace.
 */
export function CheckIn({ eventId, eventName, attendees, fullScreen = false }: { eventId: string; eventName?: string; attendees: DoorAttendee[]; fullScreen?: boolean }) {
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [scanning, setScanning] = useState(fullScreen);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [searching, setSearching] = useState(!fullScreen);
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [pending, start] = useTransition();
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isIn = (a: DoorAttendee) => checked[a.id] ?? a.checkedIn;

  function show(r: CheckInResult) {
    setResult(r);
    if ("id" in r && (r.status === "checked-in" || r.status === "already")) setChecked((c) => ({ ...c, [r.id]: true }));
    navigator.vibrate?.(isGood(r) ? 80 : [120, 80, 120]);
    if (fullScreen) {
      if (hide.current) clearTimeout(hide.current);
      hide.current = setTimeout(() => setResult(null), isGood(r) ? 2500 : 5000);
    }
  }

  const video = useScanner(scanning, (value) => start(async () => show(await checkIn(eventId, value))), (message) => {
    setCameraError(message);
    setScanning(false);
    setSearching(true);
  });

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return attendees.filter((a) => `${a.name} ${a.email} ${a.company}`.toLowerCase().includes(q)).slice(0, 12);
  }, [query, attendees]);

  const inCount = attendees.filter((a) => !a.cancelled && isIn(a)).length;
  const total = attendees.filter((a) => !a.cancelled).length;
  const undo = (id: string) =>
    start(async () => {
      await undoCheckIn(eventId, id);
      setChecked((c) => ({ ...c, [id]: false }));
      setResult(null);
    });

  const search = (
    <div>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
        <input value={query} onChange={(ev) => setQuery(ev.target.value)} placeholder="No QR code? Search by name, email or company" className="control pl-9" aria-label="Search attendees" />
      </label>
      {matches.length > 0 && (
        <ul className="mt-2 max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface text-ink">
          {matches.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{a.name}</p>
                <p className="truncate text-xs text-ink-soft">{[a.ticket, a.company, a.email].filter(Boolean).join(" · ")}</p>
              </div>
              {a.cancelled ? (
                <span className="text-xs font-medium text-rose-700">Cancelled</span>
              ) : isIn(a) ? (
                <span className="text-sm font-medium text-rose-700">Already in</span>
              ) : (
                <button type="button" disabled={pending} onClick={() => start(async () => show(await checkInById(eventId, a.id)))} className={buttonClass("primary", "sm")}>Check in</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
        <header className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{eventName}</p>
            <p className="text-sm text-white/70"><span className="tabular-nums">{inCount}</span> of {total} checked in</p>
          </div>
          <button type="button" onClick={() => setSearching((s) => !s)} className="grid size-11 place-items-center rounded-lg bg-white/10" aria-label={searching ? "Hide search" : "Search by name"}>
            <Search className="size-5" />
          </button>
          <Link href="/scan" className="grid size-11 place-items-center rounded-lg bg-white/10" aria-label="Leave the scanner"><X className="size-5" /></Link>
        </header>
        <div className="relative min-h-0 flex-1">
          {scanning ? (
            <>
              <video ref={video} muted playsInline className="absolute inset-0 size-full object-cover" />
              <div className="pointer-events-none absolute left-1/2 top-1/2 size-64 max-w-[80vw] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-4 border-white/80" />
              <p className="absolute inset-x-0 bottom-6 text-center text-sm text-white/80">Point the camera at the ticket&apos;s QR code</p>
            </>
          ) : (
            <div className="grid size-full place-items-center p-6 text-center">
              <div>
                {cameraError && <p className="mb-4 max-w-sm text-sm text-white/80">{cameraError}</p>}
                <button type="button" onClick={() => { setCameraError(null); setScanning(true); }} className={buttonClass("accent", "lg")}><Camera className="size-5" /> Start the camera</button>
              </div>
            </div>
          )}
          {result && (
            <div role="status" aria-live="assertive" className={cx("absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white", isGood(result) ? "bg-emerald-600" : "bg-rose-600")}>
              {isGood(result) ? <Check className="size-24" strokeWidth={3} /> : <X className="size-24" strokeWidth={3} />}
              <ResultText result={result} large />
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => setResult(null)} className="min-h-12 rounded-xl bg-white px-6 font-semibold text-black">Next ticket</button>
                {(result.status === "checked-in" || result.status === "already") && (
                  <button type="button" disabled={pending} onClick={() => undo(result.id)} className="min-h-12 rounded-xl px-4 text-white underline">Undo check-in</button>
                )}
              </div>
            </div>
          )}
        </div>
        {searching && <div className="max-h-[50vh] overflow-y-auto bg-paper p-4 text-ink">{search}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-5 py-4">
        <p className="text-sm"><span className="font-display text-3xl font-semibold tabular-nums">{inCount}</span> <span className="text-ink-soft">of {total} checked in</span></p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setCameraError(null); setScanning((s) => !s); }} className={buttonClass("secondary")}>
            {scanning ? <><CameraOff className="size-4" /> Stop camera</> : <><Camera className="size-4" /> Scan here</>}
          </button>
          <Link href={`/scan/${eventId}`} className={buttonClass("accent")}>Open the door scanner</Link>
        </div>
      </div>
      {cameraError && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{cameraError}</p>}
      {scanning && (
        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-black">
          <video ref={video} muted playsInline className="size-full object-cover" />
          <div className="pointer-events-none absolute inset-10 rounded-xl border-2 border-white/70" />
        </div>
      )}
      {result && <ResultPanel result={result} pending={pending} onUndo={undo} />}
      {searching && search}
    </div>
  );
}

function ResultText({ result, large = false }: { result: CheckInResult; large?: boolean }) {
  const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const title = large ? "text-4xl font-bold" : "text-2xl font-semibold";
  const sub = large ? "text-lg" : "text-sm";
  switch (result.status) {
    case "checked-in":
      return <span><span className={cx("block", title)}>Welcome, {result.name}</span><span className={cx("block", sub)}>{result.ticket} · checked in at {time(result.at)}</span></span>;
    case "already":
      return <span><span className={cx("block", title)}>Already checked in</span><span className={cx("block", sub)}>{result.name} · {result.ticket} · came in at {time(result.at)}. Same ticket twice?</span></span>;
    case "cancelled":
      return <span><span className={cx("block", title)}>Cancelled ticket</span><span className={cx("block", sub)}>{result.name} cancelled this ticket. Check with an organizer.</span></span>;
    case "unknown":
      return <span><span className={cx("block", title)}>Not a ticket for this event</span><span className={cx("block", sub)}>Try searching by name.</span></span>;
    case "denied":
      return <span className={cx("block", title)}>You&apos;re not on this event&apos;s team</span>;
  }
}

function ResultPanel({ result, pending, onUndo }: { result: CheckInResult; pending: boolean; onUndo: (id: string) => void }) {
  return (
    <div role="status" aria-live="assertive" className={cx("rounded-2xl px-5 py-4 text-white", isGood(result) ? "bg-emerald-600" : "bg-rose-600")}>
      <div className="flex items-start gap-3">
        {isGood(result) ? <Check className="mt-1 size-7 shrink-0" strokeWidth={3} /> : <X className="mt-1 size-7 shrink-0" strokeWidth={3} />}
        <ResultText result={result} />
      </div>
      {(result.status === "checked-in" || result.status === "already") && (
        <button type="button" disabled={pending} onClick={() => onUndo(result.id)} className="mt-2 text-sm underline">Undo check-in</button>
      )}
    </div>
  );
}

/** On a ticket page, for the event's team: check this person in without the scanner. */
export function TicketCheckInButton({ eventId, registrationId, checkedIn }: { eventId: string; registrationId: string; checkedIn: boolean }) {
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [pending, start] = useTransition();
  if (result) return <ResultPanel result={result} pending={pending} onUndo={(id) => start(async () => { await undoCheckIn(eventId, id); setResult(null); })} />;
  if (checkedIn) {
    return <div className="rounded-2xl bg-rose-600 px-5 py-4 text-white"><p className="text-2xl font-semibold">Already checked in</p><p className="text-sm">This ticket has been used at the entrance.</p></div>;
  }
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => setResult(await checkInById(eventId, registrationId)))} className={buttonClass("accent", "lg")}>
      Check in
    </button>
  );
}
