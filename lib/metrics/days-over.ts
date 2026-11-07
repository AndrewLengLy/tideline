import { pacificDay } from "../time";
import type { DaysOverRow, HiLo, Station, StationThresholds } from "../types";

export const DAYS_OVER_ADDS = [0, 1, 2, 3] as const;

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
      // Rounded to NOAA's 3 decimals so subtraction noise cannot push a tide over the line.
      if (Number((p.v + addFt - mhhwAboveMllw).toFixed(3)) > thresholdAboveMhhw) days.add(pacificDay(p.t));
    }
    return { addFt, days: days.size };
  });
}

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
