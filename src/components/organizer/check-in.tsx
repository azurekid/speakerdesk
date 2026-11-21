"use client";

import { Camera, CameraOff, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { buttonClass, cx } from "@/components/ui";
import { type CheckInResult, checkIn, checkInById, undoCheckIn } from "@/lib/actions/tickets";

export type DoorAttendee = { id: string; name: string; email: string; company: string; ticket: string; checkedIn: boolean; cancelled: boolean };

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/**
 * The door: scan QR codes with the device camera, or find people by name. Uses the browser's
 * BarcodeDetector where it exists (Chrome, Edge, Android) and jsQR elsewhere (Safari).
 */
export function CheckIn({ eventId, attendees }: { eventId: string; attendees: DoorAttendee[] }) {
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [pending, start] = useTransition();
  const video = useRef<HTMLVideoElement>(null);
  const lastCode = useRef<{ value: string; at: number } | null>(null);

  const isIn = (a: DoorAttendee) => checked[a.id] ?? a.checkedIn;

  function handle(r: CheckInResult) {
    setResult(r);
    if ("id" in r && (r.status === "checked-in" || r.status === "already")) setChecked((c) => ({ ...c, [r.id]: true }));
    if (r.status === "checked-in" && "vibrate" in navigator) navigator.vibrate?.(80);
  }

  // Camera loop: decode a few frames a second; ignore the same code for 3 seconds.
  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    const canvas = document.createElement("canvas");
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        setCameraError("No camera access. Allow the camera in your browser, or search by name below.");
        setScanning(false);
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
        const now = Date.now();
        if (lastCode.current && lastCode.current.value === value && now - lastCode.current.at < 3000) return;
        lastCode.current = { value, at: now };
        start(async () => handle(await checkIn(eventId, value!)));
      }, 250);
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanning, eventId]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return attendees.filter((a) => `${a.name} ${a.email} ${a.company}`.toLowerCase().includes(q)).slice(0, 12);
  }, [query, attendees]);

  const inCount = attendees.filter((a) => !a.cancelled && isIn(a)).length;
  const total = attendees.filter((a) => !a.cancelled).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-5 py-4">
        <p className="text-sm"><span className="font-display text-3xl font-semibold tabular-nums">{inCount}</span> <span className="text-ink-soft">of {total} checked in</span></p>
        <button type="button" onClick={() => { setCameraError(null); setScanning((s) => !s); }} className={buttonClass(scanning ? "secondary" : "accent", "lg")}>
          {scanning ? <><CameraOff className="size-5" /> Stop camera</> : <><Camera className="size-5" /> Scan tickets</>}
        </button>
      </div>

      {cameraError && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{cameraError}</p>}
      {scanning && (
        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-black">
          <video ref={video} muted playsInline className="size-full object-cover" />
          <div className="pointer-events-none absolute inset-10 rounded-xl border-2 border-white/70" />
        </div>
      )}

      {result && <ResultPanel result={result} pending={pending} onUndo={(id) => start(async () => { await undoCheckIn(eventId, id); setChecked((c) => ({ ...c, [id]: false })); setResult(null); })} />}

      <div>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
          <input value={query} onChange={(ev) => setQuery(ev.target.value)} placeholder="No QR code? Search by name, email or company" className="control pl-9" aria-label="Search attendees" />
        </label>
        {matches.length > 0 && (
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
            {matches.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.name}</p>
                  <p className="truncate text-xs text-ink-soft">{[a.ticket, a.company, a.email].filter(Boolean).join(" · ")}</p>
                </div>
                {a.cancelled ? (
                  <span className="text-xs text-rose-700">Cancelled</span>
                ) : isIn(a) ? (
                  <span className="text-sm font-medium text-emerald-800">In ✓</span>
                ) : (
                  <button type="button" disabled={pending} onClick={() => start(async () => handle(await checkInById(eventId, a.id)))} className={buttonClass("primary", "sm")}>Check in</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ResultPanel({ result, pending, onUndo }: { result: CheckInResult; pending: boolean; onUndo: (id: string) => void }) {
  const tone = {
    "checked-in": "border-emerald-200 bg-emerald-50 text-emerald-900",
    already: "border-amber-200 bg-amber-50 text-amber-900",
    cancelled: "border-rose-200 bg-rose-50 text-rose-800",
    unknown: "border-rose-200 bg-rose-50 text-rose-800",
    denied: "border-rose-200 bg-rose-50 text-rose-800",
  }[result.status];
  const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div role="status" aria-live="assertive" className={cx("rounded-2xl border px-5 py-4", tone)}>
      {result.status === "checked-in" && <><p className="text-2xl font-semibold">Welcome, {result.name}</p><p className="text-sm">{result.ticket} · checked in at {time(result.at)}</p></>}
      {result.status === "already" && <><p className="text-2xl font-semibold">Already in: {result.name}</p><p className="text-sm">{result.ticket} · checked in at {time(result.at)}. Same ticket twice?</p></>}
      {result.status === "cancelled" && <><p className="text-2xl font-semibold">Cancelled ticket</p><p className="text-sm">{result.name} cancelled this ticket. Check with an organizer.</p></>}
      {result.status === "unknown" && <><p className="text-2xl font-semibold">Not a ticket for this event</p><p className="text-sm">Try searching by name.</p></>}
      {result.status === "denied" && <p className="text-2xl font-semibold">You&apos;re not on this event&apos;s team</p>}
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
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => setResult(await checkInById(eventId, registrationId)))} className={buttonClass(checkedIn ? "secondary" : "accent", "lg")}>
      {checkedIn ? "Already checked in. Check again" : "Check in"}
    </button>
  );
}
