// Planning a visit to see a king tide: the viewing window, whether it falls in the dark, and
// which shoreline spots near the gauge to stand at.
import { haversineMi } from "../geo";
import { TZ } from "../time";
import type { MapSpot, MapStation } from "../types";

const HOUR = 3_600_000;

/** Water stays within a few inches of a high tide's peak for about an hour on either side. */
export const VIEW_WINDOW_MS = HOUR;

/** Approximate San Francisco sunrise and sunset by month, local clock hours, rounded to 15 minutes. */
const DAYLIGHT: [number, number][] = [
  [7.5, 17.25],
  [7, 17.75],
  [7.25, 19.25],
  [6.75, 19.75],
  [6, 20.25],
  [5.75, 20.5],
  [6, 20.5],
  [6.5, 20],
  [6.75, 19.25],
  [7.25, 18.5],
  [6.75, 17],
  [7.25, 17],
];

const PARTS = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" });

/** "dark" when the peak falls before sunrise or after sunset, "dusk" within half an hour of either. */
export function lightAt(t: number): "day" | "dusk" | "dark" {
  const p = Object.fromEntries(PARTS.formatToParts(t).map((x) => [x.type, x.value]));
  const [rise, set] = DAYLIGHT[Number(p.month) - 1];
  const h = Number(p.hour) + Number(p.minute) / 60;
  if (h < rise - 0.5 || h > set + 0.5) return "dark";
  if (h < rise + 0.5 || h > set - 0.5) return "dusk";
  return "day";
}

/**
 * Up to n spots to watch from. Spots tied to the gauge come first. Gauges with none fall back to
 * the nearest spots. Reported flooding ranks first, then the lowest NOAA step, then distance.
 */
export function spotsToWatch(station: Pick<MapStation, "id" | "lat" | "lng">, spots: MapSpot[], n = 3): MapSpot[] {
  const tied = spots.filter((s) => s.nearestStationId === station.id);
  const pool = tied.length ? tied : spots;
  const dist = (s: MapSpot) => haversineMi(station.lat, station.lng, s.lat, s.lng);
  return [...pool]
    .sort((a, b) => Number(b.floodingReported) - Number(a.floodingReported) || (a.firstFloodFt ?? 99) - (b.firstFloodFt ?? 99) || dist(a) - dist(b))
    .slice(0, n);
}
