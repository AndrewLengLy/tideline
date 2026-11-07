import "server-only";
import { cache } from "react";
import { daysOverForStation, countingThreshold } from "./metrics/days-over";
import { bayCalendar, highestTides, nextTide } from "./metrics/king-tides";
import { residualSeries, surgeSummary } from "./metrics/surge";
import { fetchCurve, fetchHilo, fetchObserved, fetchPredictedForObserved } from "./sources/coops";
import { OUTER_COAST_IDS, STATIONS, stationById } from "./stations";
import { DAY, pacificDay } from "./time";
import type { HiLo, Overview, SeriesPoint, Station, StationOverview, SurgeSummary } from "./types";

/** The next 12 months of predicted highs and lows, starting today in Pacific time. */
export const getYearHilo = cache(async (stationId: string): Promise<HiLo[]> => fetchHilo(stationId, pacificDay(Date.now()), 365));

function overviewFor(station: Station, hilo: HiLo[], now: number): StationOverview {
  const kingTides = highestTides(hilo, station);
  const counting = countingThreshold(station.thresholds);
  return {
    stationId: station.id,
    kingTides,
    next: nextTide(kingTides, now),
    daysOver: daysOverForStation(hilo, station),
    thresholdKind: counting?.kind ?? null,
    thresholdFt: counting?.ft ?? null,
    highCount: hilo.filter((p) => p.type === "H").length,
  };
}

/** Derived numbers for every station. A station whose request fails is listed in `failed` and the rest still render. */
export const getOverview = cache(async (): Promise<Overview> => {
  const now = Date.now();
  const settled = await Promise.allSettled(STATIONS.map((s) => getYearHilo(s.id)));
  const stations: StationOverview[] = [];
  const failed: string[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") stations.push(overviewFor(STATIONS[i], r.value, now));
    else failed.push(STATIONS[i].id);
  });
  return { asOf: now, stations, calendar: bayCalendar(stations.filter((s) => !OUTER_COAST_IDS.has(s.stationId)).map((s) => s.kingTides)), failed };
});

export async function getStationOverview(stationId: string): Promise<StationOverview | null> {
  const station = stationById(stationId);
  if (!station) return null;
  const overview = await getOverview();
  return overview.stations.find((s) => s.stationId === stationId) ?? null;
}

export interface StationLive {
  asOf: number;
  observed: SeriesPoint[];
  predicted: SeriesPoint[];
  residual: SeriesPoint[];
  surge: SurgeSummary | null;
}

/** Observed water level for the last 72 hours with its residual against the prediction. */
export async function getStationLive(stationId: string, now = Date.now()): Promise<StationLive> {
  const [observed, predictedAll] = await Promise.all([fetchObserved(stationId), fetchPredictedForObserved(stationId, now)]);
  const start = observed[0]?.t ?? now - 3 * DAY;
  const end = observed[observed.length - 1]?.t ?? now;
  const predicted = predictedAll.filter((p) => p.t >= start && p.t <= end);
  const residual = residualSeries(observed, predicted);
  return { asOf: end, observed, predicted, residual, surge: surgeSummary(residual) };
}

export const getCurve = (stationId: string, fromDay: string, days = 7) => fetchCurve(stationId, fromDay, days);
