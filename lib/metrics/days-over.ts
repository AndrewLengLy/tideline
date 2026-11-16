import { addDays, pacificDay } from "../time";
import type { DaysOverRow, HiLo, Station, StationThresholds } from "../types";

export const DAYS_OVER_ADDS = [0, 1, 2, 3] as const;

/**
 * True when a high tide plus added height crosses the line. Rounded to NOAA's 3 decimals so
 * subtraction noise cannot push a tide over. The day counts and the calendar city share this test.
 * @param heightMllw feet above MLLW
 * @param thresholdAboveMhhw feet above MHHW
 */
export function crossesLine(heightMllw: number, addFt: number, mhhwAboveMllw: number, thresholdAboveMhhw: number): boolean {
  return Number((heightMllw + addFt - mhhwAboveMllw).toFixed(3)) > thresholdAboveMhhw;
}

/**
 * Counts Pacific calendar days holding at least one predicted high above the threshold,
 * then recounts with each added height applied to every prediction.
 * @param thresholdAboveMhhw feet above MHHW
 */
export function daysOverThreshold(
  hilo: HiLo[],
  mhhwAboveMllw: number,
  thresholdAboveMhhw: number,
  adds: readonly number[] = DAYS_OVER_ADDS,
): DaysOverRow[] {
  const highs = hilo.filter((p) => p.type === "H");
  return adds.map((addFt) => {
    const days = new Set<string>();
    for (const p of highs) {
      if (crossesLine(p.v, addFt, mhhwAboveMllw, thresholdAboveMhhw)) days.add(pacificDay(p.t));
    }
    return { addFt, days: days.size };
  });
}

export interface DailyMax {
  /** First Pacific day, "YYYY-MM-DD". */
  start: string;
  /** Highest predicted high per day in feet above MLLW, in NOAA's 3 decimals. Null for a day with no high. */
  max: (number | null)[];
}

/**
 * The highest predicted high on each Pacific day, from the first day in the list to the last.
 * Kept at NOAA's 3 decimals. At 2 decimals a high of 5.501 ft rounds to 5.50 and drops off a
 * line at 5.50, so the calendar would disagree with daysOverThreshold.
 */
export function dailyMaxHighs(hilo: HiLo[]): DailyMax {
  if (!hilo.length) return { start: "", max: [] };
  const start = pacificDay(hilo[0].t);
  const index = new Map<string, number>();
  const max: (number | null)[] = [];
  const last = pacificDay(hilo[hilo.length - 1].t);
  for (let d = start, i = 0; d <= last; d = addDays(d, 1), i++) {
    index.set(d, i);
    max.push(null);
  }
  for (const p of hilo) {
    if (p.type !== "H") continue;
    const i = index.get(pacificDay(p.t));
    if (i === undefined) continue;
    const cur = max[i];
    if (cur === null || p.v > cur) max[i] = Number(p.v.toFixed(3));
  }
  return { start, max };
}

/** Days whose highest high crosses the line with `addFt` added. Equals daysOverThreshold for the same highs. */
export function floodDaysFromDaily(max: (number | null)[], addFt: number, mhhwAboveMllw: number, thresholdAboveMhhw: number): number {
  let n = 0;
  for (const v of max) if (v !== null && crossesLine(v, addFt, mhhwAboveMllw, thresholdAboveMhhw)) n++;
  return n;
}

/** Words for the counting line: "flood line" for NOAA's minor threshold, "action level" where only that exists. */
export const lineWords = (kind: "minor" | "action" | null) => (kind === "action" ? "action level" : "flood line");

/** NOAA's minor threshold when it exists, otherwise the gauge's action level, which is labeled as such in the UI. */
export function countingThreshold(t: StationThresholds): { kind: "minor" | "action"; ft: number } | null {
  if (t.minor !== null) return { kind: "minor", ft: t.minor };
  if (t.action !== null) return { kind: "action", ft: t.action };
  return null;
}

export function daysOverForStation(hilo: HiLo[], station: Pick<Station, "datums" | "thresholds">): DaysOverRow[] {
  const c = countingThreshold(station.thresholds);
  return c ? daysOverThreshold(hilo, station.datums.mhhw, c.ft) : [];
}
