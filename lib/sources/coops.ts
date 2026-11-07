// CO-OPS data API: tide predictions and observed water levels.
// Limits from the API docs: high/low requests cover up to 1 year, 6-minute requests up to 1 month.
import { z } from "zod";
import { addDays, DAY, localSeriesToUtc, noaaDate, pacificDay } from "../time";
import type { HiLo, SeriesPoint } from "../types";
import { getJson } from "./http";

const BASE = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
const COMMON = "application=tideline&datum=MLLW&time_zone=lst_ldt&units=english&format=json";

export const MAX_HILO_DAYS = 365;
export const MAX_CURVE_DAYS = 31;

export const hiloSchema = z.object({
  predictions: z.array(z.object({ t: z.string(), v: z.string(), type: z.enum(["H", "L"]) })),
});
export const curveSchema = z.object({
  predictions: z.array(z.object({ t: z.string(), v: z.string() })),
});
export const waterLevelSchema = z.object({
  metadata: z.object({ id: z.string(), name: z.string(), lat: z.string(), lon: z.string() }),
  data: z.array(z.object({ t: z.string(), v: z.string(), s: z.string().optional(), f: z.string().optional(), q: z.string().optional() })),
});

export function parseHilo(json: z.output<typeof hiloSchema>): HiLo[] {
  const times = localSeriesToUtc(json.predictions.map((p) => p.t));
  return json.predictions.map((p, i) => ({ t: times[i], v: Number(p.v), type: p.type }));
}

export function parseCurve(json: z.output<typeof curveSchema>): SeriesPoint[] {
  const times = localSeriesToUtc(json.predictions.map((p) => p.t));
  return json.predictions.map((p, i) => ({ t: times[i], v: Number(p.v) }));
}

/** Gauge dropouts arrive as empty strings, so those rows are removed. */
export function parseWaterLevel(json: z.output<typeof waterLevelSchema>): SeriesPoint[] {
  const rows = json.data.filter((d) => d.v !== "" && Number.isFinite(Number(d.v)));
  const times = localSeriesToUtc(rows.map((d) => d.t));
  return rows.map((d, i) => ({ t: times[i], v: Number(d.v) }));
}

/** Splits a day range into pieces no longer than maxDays. Each piece's end day is inclusive. */
export function chunkDays(startDay: string, days: number, maxDays: number): { begin: string; end: string }[] {
  const out: { begin: string; end: string }[] = [];
  for (let done = 0; done < days; done += maxDays) {
    const len = Math.min(maxDays, days - done);
    out.push({ begin: addDays(startDay, done), end: addDays(startDay, done + len - 1) });
  }
  return out;
}

export const PREDICTION_CACHE = { revalidate: 86_400, tags: ["predictions"] };
export const OBSERVED_CACHE = { revalidate: 360, tags: ["observed"] };

/** High and low predictions starting on a Pacific day. */
export async function fetchHilo(stationId: string, startDay: string, days = 365): Promise<HiLo[]> {
  const parts = await Promise.all(
    chunkDays(startDay, days, MAX_HILO_DAYS).map(({ begin, end }) =>
      getJson(
        `${BASE}?product=predictions&interval=hilo&station=${stationId}&begin_date=${noaaDate(begin)}&end_date=${noaaDate(end)}&${COMMON}`,
        hiloSchema,
        { source: `CO-OPS hilo ${stationId}`, ...PREDICTION_CACHE },
      ).then(parseHilo),
    ),
  );
  return parts.flat();
}

/** 6-minute predicted water level for whole Pacific days. */
export async function fetchCurve(stationId: string, startDay: string, days = 7): Promise<SeriesPoint[]> {
  const parts = await Promise.all(
    chunkDays(startDay, days, MAX_CURVE_DAYS).map(({ begin, end }) =>
      getJson(
        `${BASE}?product=predictions&interval=6&station=${stationId}&begin_date=${noaaDate(begin)}&end_date=${noaaDate(end)}&${COMMON}`,
        curveSchema,
        { source: `CO-OPS curve ${stationId}`, ...PREDICTION_CACHE },
      ).then(parseCurve),
    ),
  );
  return parts.flat();
}

/** Observed water level for the last 72 hours. */
export async function fetchObserved(stationId: string): Promise<SeriesPoint[]> {
  const json = await getJson(`${BASE}?product=water_level&range=72&station=${stationId}&${COMMON}`, waterLevelSchema, {
    source: `CO-OPS water level ${stationId}`,
    ...OBSERVED_CACHE,
  });
  return parseWaterLevel(json);
}

/** Predictions covering the same 72 hours as fetchObserved, for the residual. */
export async function fetchPredictedForObserved(stationId: string, now = Date.now()): Promise<SeriesPoint[]> {
  const start = pacificDay(now - 3 * DAY - DAY);
  return fetchCurve(stationId, start, 6);
}
