import "server-only";

/** A venue / address suggestion, normalized across providers. */
export type Place = {
  id: string;
  name: string;     // venue or street name
  address: string;  // single-line street address
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  kind: string;     // e.g. "conference centre", "address"
};

const TIMEOUT_MS = 6000;
const UA = "SpeakerDesk/1.0 (venue search)";

/**
 * Azure Maps when AZURE_MAPS_KEY is set (production), otherwise Photon —
 * the free, OpenStreetMap-based search built for type-ahead (fine for development and low volume).
 */
export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim().slice(0, 120);
  if (q.length < 3) return [];
  return process.env.AZURE_MAPS_KEY ? azureMaps(q, process.env.AZURE_MAPS_KEY) : photon(q);
}

type AzureResult = {
  id: string;
  type: string;
  poi?: { name?: string; categories?: string[] };
  address?: { freeformAddress?: string; streetName?: string; streetNumber?: string; municipality?: string; country?: string; countryCode?: string };
  position: { lat: number; lon: number };
};

async function azureMaps(q: string, key: string): Promise<Place[]> {
  const url = new URL("https://atlas.microsoft.com/search/fuzzy/json");
  url.search = new URLSearchParams({ "api-version": "1.0", query: q, typeahead: "true", limit: "6", language: "en-GB" }).toString();
  const res = await fetch(url, { headers: { "subscription-key": key }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`Azure Maps returned ${res.status}`);
  const data = (await res.json()) as { results?: AzureResult[] };
  return (data.results ?? []).map((r) => {
    const a = r.address ?? {};
    const street = [a.streetName, a.streetNumber].filter(Boolean).join(" ");
    return {
      id: r.id,
      name: r.poi?.name ?? street ?? a.freeformAddress ?? q,
      address: a.freeformAddress ?? street,
      city: a.municipality ?? "",
      country: a.country ?? "",
      latitude: r.position.lat,
      longitude: r.position.lon,
      kind: r.poi?.categories?.[0] ?? (r.type === "POI" ? "venue" : "address"),
    };
  });
}

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id: number; osm_type: string; osm_value?: string; name?: string; street?: string; housenumber?: string;
    postcode?: string; city?: string; country?: string; countrycode?: string;
  };
};

async function photon(q: string): Promise<Place[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.search = new URLSearchParams({ q, limit: "6", lang: "en" }).toString();
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`Photon returned ${res.status}`);
  const data = (await res.json()) as { features?: PhotonFeature[] };
  const seen = new Set<string>();
  return (data.features ?? [])
    .map((f) => {
      const p = f.properties;
      const street = [p.street, p.housenumber].filter(Boolean).join(" ");
      const address = [street, [p.postcode, p.city].filter(Boolean).join(" "), p.country].filter(Boolean).join(", ");
      return {
        id: `${p.osm_type}${p.osm_id}`,
        name: p.name ?? street ?? q,
        address,
        city: p.city ?? "",
        country: p.country ?? "",
        latitude: f.geometry.coordinates[1],
        longitude: f.geometry.coordinates[0],
        kind: (p.osm_value ?? "place").replace(/_/g, " "),
      };
    })
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}
