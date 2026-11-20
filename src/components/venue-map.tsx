/** OpenStreetMap embed (no API key needed) with a marker on the venue. */
export function VenueMap({ latitude, longitude, title, className }: { latitude: number; longitude: number; title: string; className?: string }) {
  const d = 0.006;
  const bbox = [longitude - d * 1.6, latitude - d, longitude + d * 1.6, latitude + d].map((n) => n.toFixed(5)).join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  return (
    <div className={className}>
      <iframe title={`Map of ${title}`} src={src} loading="lazy" className="h-full min-h-48 w-full rounded-xl border border-line" />
      <a
        href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-block text-xs text-ink-soft hover:text-ink"
      >
        Open larger map ↗
      </a>
    </div>
  );
}
