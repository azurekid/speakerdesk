"use client";

import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cx, Field } from "@/components/ui";
import { VenueMap } from "@/components/venue-map";

type Place = { id: string; name: string; address: string; city: string; country: string; latitude: number; longitude: number; kind: string };
export type VenueValues = { venue: string; address: string; location: string; latitude: number | null; longitude: number | null };

/**
 * Search-as-you-type for venues and addresses. Picking a result fills venue, address,
 * city/country and coordinates; every field stays editable for corrections or "Online".
 */
export function VenuePicker({ initial, errors }: { initial: VenueValues; errors?: Record<string, string[] | undefined> }) {
  const [values, setValues] = useState(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);

  // Debounced search; aborts stale requests so results never arrive out of order.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { places: Place[]; error?: string };
        setResults(data.places);
        setError(data.error ?? null);
        setActive(0);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Venue search failed. Enter the details by hand.");
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function pick(p: Place) {
    setValues({
      venue: p.name,
      address: p.address,
      location: [p.city, p.country].filter(Boolean).join(", "),
      latitude: p.latitude,
      longitude: p.longitude,
    });
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  const set = (k: keyof VenueValues) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <div className="space-y-4 sm:col-span-2">
      <div ref={box} className="relative">
        <label htmlFor="venue-search" className="mb-1 block text-sm font-medium">Find the venue</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            id="venue-search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length < 3) {
                setResults([]);
                setOpen(false);
              }
            }}
            onFocus={() => results.length && setOpen(true)}
            onKeyDown={(e) => {
              if (!open || !results.length) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                pick(results[active]);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Search by venue name or address, e.g. “Beurs van Berlage”"
            className="control pl-9"
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-neutral-400" />}
        </div>
        {open && (
          <ul id={listId} role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
            {results.length === 0 && <li className="px-4 py-3 text-sm text-ink-soft">No matches. Fill in the fields below by hand.</li>}
            {results.map((p, i) => (
              <li
                key={p.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p);
                }}
                onMouseEnter={() => setActive(i)}
                className={cx("flex cursor-pointer items-start gap-3 px-4 py-2.5", i === active && "bg-neutral-50")}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-600" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="truncate text-xs text-ink-soft">{p.address || [p.city, p.country].filter(Boolean).join(", ")}</p>
                </div>
                <span className="ml-auto shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] capitalize text-ink-soft">{p.kind}</span>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-1 text-xs text-amber-700">{error}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
        <div className="grid gap-4">
          <Field label="Venue" htmlFor="venue" error={errors?.venue}>
            <input id="venue" name="venue" value={values.venue} onChange={set("venue")} placeholder="Venue name" className="control" />
          </Field>
          <Field label="Street address" htmlFor="address" error={errors?.address}>
            <input id="address" name="address" value={values.address} onChange={set("address")} placeholder="Damrak 243, 1012 ZJ Amsterdam" className="control" />
          </Field>
          <Field label="City / country" htmlFor="location" error={errors?.location} hint="Shown on event cards. Use “Online” for virtual events.">
            <input id="location" name="location" value={values.location} onChange={set("location")} placeholder="Amsterdam, Netherlands" className="control" />
          </Field>
          <input type="hidden" name="latitude" value={values.latitude ?? ""} />
          <input type="hidden" name="longitude" value={values.longitude ?? ""} />
        </div>
        {values.latitude !== null && values.longitude !== null ? (
          <div>
            <VenueMap latitude={values.latitude} longitude={values.longitude} title={values.venue || "venue"} className="h-56" />
            <button type="button" onClick={() => setValues((v) => ({ ...v, latitude: null, longitude: null }))} className="text-xs text-ink-soft underline hover:text-ink">
              Remove map pin
            </button>
          </div>
        ) : (
          <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-line text-center text-sm text-ink-soft">
            <p className="px-6">Search above to pin the venue on a map.</p>
          </div>
        )}
      </div>
    </div>
  );
}
