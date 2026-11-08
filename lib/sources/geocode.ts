// Address search for "Check a place", through Photon, a free OpenStreetMap geocoder from Komoot.
// Results stay inside the Bay Area box, the area NOAA's Bay layers cover.

export interface GeoHit {
  label: string;
  lng: number;
  lat: number;
}

const BAY_BBOX = "-123.2,37.1,-121.5,38.4";
export const GEOCODER_ORIGIN = "https://photon.komoot.io";

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; housenumber?: string; street?: string; city?: string; district?: string; county?: string };
}

/** Turns one Photon result into a short line, such as "1 Ferry Building, San Francisco". */
export function photonLabel(p: PhotonFeature["properties"]): string {
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const first = p.name && p.name !== street ? p.name : street || p.name || "Unnamed place";
  const place = p.city ?? p.district ?? p.county;
  return [first, place].filter((v, i, a) => v && a.indexOf(v) === i).join(", ");
}

export async function searchPlaces(q: string, signal?: AbortSignal): Promise<GeoHit[]> {
  const url = `${GEOCODER_ORIGIN}/api/?q=${encodeURIComponent(q)}&limit=5&lang=en&bbox=${BAY_BBOX}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Search failed with HTTP ${res.status}`);
  const json = (await res.json()) as { features?: PhotonFeature[] };
  return (json.features ?? []).map((f) => ({ label: photonLabel(f.properties), lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));
}
