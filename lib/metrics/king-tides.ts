import { fmtMonthDay, fmtWeekday, round1 } from "../format";
import { DAY } from "../time";
import type { HiLo, KingTide, Station } from "../types";

export const KING_TIDE_COUNT = 20;

/** Height above MHHW for a value in feet above MLLW. */
export const aboveMhhw = (heightMllw: number, mhhwAboveMllw: number) => Number((heightMllw - mhhwAboveMllw).toFixed(3));

/** The sea level rise, in feet, at which this water level becomes an ordinary daily high. */
export const futureTideEquivalent = (aboveMhhwFt: number) => Math.max(0, round1(aboveMhhwFt));

/** The n highest predicted high tides by height above MHHW, highest first. */
export function highestTides(hilo: HiLo[], station: Pick<Station, "id" | "name" | "slug" | "datums">, n = KING_TIDE_COUNT): KingTide[] {
  return hilo
    .filter((p) => p.type === "H")
    .map((p) => ({
      stationId: station.id,
      stationName: station.name,
      stationSlug: station.slug,
      t: p.t,
      height: p.v,
      aboveMhhw: aboveMhhw(p.v, station.datums.mhhw),
    }))
    .sort((a, b) => b.aboveMhhw - a.aboveMhhw || a.t - b.t)
    .slice(0, n);
}

/** The earliest upcoming tide from a list. */
export function nextTide(list: KingTide[], now: number): KingTide | null {
  let best: KingTide | null = null;
  for (const k of list) if (k.t >= now && (!best || k.t < best.t)) best = k;
  return best;
}

/** The n highest tides across the given stations, ranked by height above MHHW and listed in date order. */
export function bayCalendar(perStation: KingTide[][], n = KING_TIDE_COUNT): KingTide[] {
  return perStation
    .flat()
    .sort((a, b) => b.aboveMhhw - a.aboveMhhw || a.t - b.t)
    .slice(0, n)
    .sort((a, b) => a.t - b.t);
}

/** "Saturday's 7.1 ft high at Alameda sits 1.2 ft above MHHW. With 1.2 ft of sea level rise, that becomes a normal high tide." */
export function kingTideSentence(k: KingTide, now: number): string {
  const within = k.t - now < 6 * DAY && k.t >= now;
  const when = within ? fmtWeekday(k.t) : fmtMonthDay(k.t);
  const eq = futureTideEquivalent(k.aboveMhhw).toFixed(1);
  if (k.aboveMhhw <= 0) {
    return `${when}'s ${k.height.toFixed(1)} ft high at ${k.stationName} stays at or below MHHW, the height of an ordinary daily high.`;
  }
  return `${when}'s ${k.height.toFixed(1)} ft high at ${k.stationName} sits ${eq} ft above MHHW. With ${eq} ft of sea level rise, that becomes a normal high tide.`;
}
