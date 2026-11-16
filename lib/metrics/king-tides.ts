import { fmtDayLabel, fmtMonthDay, fmtMonthName, fmtWeekday, round1 } from "../format";
import { DAY, dayStart, HOUR, pacificDay } from "../time";
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

/** "Saturday's 7.1 ft high at Alameda sits 1.2 ft above an average high tide. With 1.2 ft of sea level rise, that becomes an ordinary high tide." */
export function kingTideSentence(k: KingTide, now: number): string {
  const within = k.t - now < 6 * DAY && k.t >= now;
  const when = within ? fmtWeekday(k.t) : fmtMonthDay(k.t);
  const eq = futureTideEquivalent(k.aboveMhhw).toFixed(1);
  if (k.aboveMhhw <= 0) {
    return `${when}'s ${k.height.toFixed(1)} ft high at ${k.stationName} stays at or below an average high tide, the height of an ordinary daily high.`;
  }
  return `${when}'s ${k.height.toFixed(1)} ft high at ${k.stationName} sits ${eq} ft above an average high tide. With ${eq} ft of sea level rise, that becomes an ordinary high tide.`;
}

/** "about 1 ft above an average high tide", to the nearest half foot. */
export function aboutHighTide(aboveMhhwFt: number): string {
  const r = Math.round(aboveMhhwFt * 2) / 2;
  if (r === 0) return "about level with an average high tide";
  const n = Math.abs(r);
  return `about ${Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1)} ft ${r > 0 ? "above" : "below"} an average high tide`;
}

const dayDiff = (a: string, b: string) => {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / DAY);
};

/**
 * One sentence on the selected station: its highest predicted tide for the rest of this month,
 * or for the next 30 days once fewer than a week of the month is left.
 * "Alameda's highest tide for the rest of November is 7.7 ft on Tue Nov 24, about 1 ft above an average high tide."
 * @param daily highest predicted high per Pacific day, feet above MLLW, starting on `start`
 */
export function stationSentence(name: string, daily: (number | null)[], start: string, mhhwAboveMllw: number, now: number): string | null {
  if (!start || !daily.length) return null;
  const today = pacificDay(now);
  const i0 = Math.max(0, dayDiff(start, today));
  const month = today.slice(0, 7);
  let monthLeft = 0;
  for (let i = i0; i < daily.length && pacificDay(dayStart(start) + (i + 0.5) * DAY).slice(0, 7) === month; i++) monthLeft++;
  const span = monthLeft >= 7 ? monthLeft : 30;
  let best = -1;
  for (let i = i0; i < Math.min(daily.length, i0 + span); i++) {
    const v = daily[i];
    if (v !== null && (best < 0 || v > (daily[best] as number))) best = i;
  }
  if (best < 0) return null;
  const v = daily[best] as number;
  const at = dayStart(start) + best * DAY + 12 * HOUR;
  const when = monthLeft >= 7 ? `for the rest of ${fmtMonthName(now)}` : "in the next 30 days";
  return `${name}'s highest tide ${when} is ${v.toFixed(1)} ft on ${fmtDayLabel(at)}, ${aboutHighTide(v - mhhwAboveMllw)}.`;
}
