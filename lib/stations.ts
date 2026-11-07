import raw from "../data/stations.json";
import { haversineMi } from "./geo";
import type { Station } from "./types";

export const STATIONS = raw.stations as Station[];
export const STATIONS_GENERATED_AT = Date.parse(raw.generatedAt);

/** Gauges on the open coast. Point Reyes runs higher than any Bay gauge, so the Bay calendar leaves it out. */
export const OUTER_COAST_IDS = new Set(["9415020"]);

const byId = new Map(STATIONS.map((s) => [s.id, s]));
const bySlug = new Map(STATIONS.map((s) => [s.slug, s]));

export const stationById = (id: string | null | undefined) => (id ? byId.get(id) : undefined);
export const stationBySlug = (slug: string) => bySlug.get(slug);

/** The nearest gauge to a point, by great-circle distance. */
export function nearestStation(lat: number, lng: number, pool: Station[] = STATIONS): { station: Station; miles: number } {
  let best = pool[0];
  let bestMi = Infinity;
  for (const s of pool) {
    const mi = haversineMi(lat, lng, s.lat, s.lng);
    if (mi < bestMi) {
      best = s;
      bestMi = mi;
    }
  }
  return { station: best, miles: bestMi };
}

