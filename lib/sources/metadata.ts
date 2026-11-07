// CO-OPS metadata and derived product APIs. Used by scripts/build-stations.ts to write data/stations.json.
import { z } from "zod";
import type { FloodDayCount, StationDatums, StationThresholds } from "../types";
import { getJson } from "./http";

const MD = "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi";
const DP = "https://api.tidesandcurrents.noaa.gov/dpapi/prod/webapi";

export const stationListSchema = z.object({
  stations: z.array(z.object({ id: z.string(), name: z.string(), lat: z.number(), lng: z.number() }).loose()),
});
export const datumsSchema = z.object({
  epoch: z.string().nullable().optional(),
  datums: z.array(z.object({ name: z.string(), value: z.number().nullable() })),
});
export const floodLevelsSchema = z.object({
  nos_minor: z.number().nullable(),
  nos_moderate: z.number().nullable(),
  nos_major: z.number().nullable(),
  nws_minor: z.number().nullable(),
  nws_moderate: z.number().nullable(),
  nws_major: z.number().nullable(),
  action: z.number().nullable(),
});
export const floodCountSchema = z.object({
  MetYearAnnualFloodCount: z.array(
    z.object({
      metYear: z.number(),
      majCount: z.number().nullable(),
      modCount: z.number().nullable(),
      minCount: z.number().nullable(),
      percent_completeness: z.number().nullable(),
    }),
  ),
});

/** NOAA gives datums above the station datum. Tideline stores them above MLLW. */
export function parseDatums(json: z.output<typeof datumsSchema>): StationDatums & { mhhwStnd: number } {
  const get = (n: string) => json.datums.find((d) => d.name === n)?.value ?? null;
  const mllw = get("MLLW");
  const mhhw = get("MHHW");
  const msl = get("MSL");
  if (mllw === null || mhhw === null || msl === null) throw new Error("Datums response lacks MLLW, MHHW, or MSL");
  const rel = (v: number | null) => (v === null ? null : Number((v - mllw).toFixed(2)));
  return {
    epoch: json.epoch ?? "unknown",
    mhhw: Number((mhhw - mllw).toFixed(2)),
    mhw: rel(get("MHW")),
    msl: Number((msl - mllw).toFixed(2)),
    mlw: rel(get("MLW")),
    mllw: 0,
    navd88: rel(get("NAVD88")),
    mhhwStnd: mhhw,
  };
}

/** Flood levels arrive above the station datum. Tideline stores them above MHHW. */
export function parseFloodLevels(json: z.output<typeof floodLevelsSchema>, mhhwStnd: number): StationThresholds {
  const rel = (v: number | null) => (v === null ? null : Number((v - mhhwStnd).toFixed(2)));
  return {
    minor: rel(json.nos_minor),
    moderate: rel(json.nos_moderate),
    major: rel(json.nos_major),
    nwsMinor: rel(json.nws_minor),
    action: rel(json.action),
  };
}

export function parseFloodCounts(json: z.output<typeof floodCountSchema>): FloodDayCount[] {
  return json.MetYearAnnualFloodCount.map((r) => ({
    metYear: r.metYear,
    minor: r.minCount ?? 0,
    moderate: r.modCount ?? 0,
    major: r.majCount ?? 0,
    completeness: r.percent_completeness ?? 0,
  }));
}

export const fetchStationList = (type: "waterlevels" | "tidepredictions") =>
  getJson(`${MD}/stations.json?type=${type}`, stationListSchema, { source: `CO-OPS stations ${type}`, timeoutMs: 45_000 });

export const fetchDatums = async (id: string) =>
  parseDatums(await getJson(`${MD}/stations/${id}/datums.json?units=english`, datumsSchema, { source: `CO-OPS datums ${id}` }));

export const fetchFloodLevels = async (id: string, mhhwStnd: number) =>
  parseFloodLevels(await getJson(`${MD}/stations/${id}/floodlevels.json?units=english`, floodLevelsSchema, { source: `CO-OPS flood levels ${id}` }), mhhwStnd);

export const fetchFloodCounts = async (id: string) =>
  parseFloodCounts(await getJson(`${DP}/htf/htf_met_year_annual.json?station=${id}`, floodCountSchema, { source: `CO-OPS flood counts ${id}` }));
