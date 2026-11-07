import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chunkDays, curveSchema, hiloSchema, MAX_CURVE_DAYS, parseCurve, parseHilo, parseWaterLevel, waterLevelSchema } from "@/lib/sources/coops";
import { getJson, SourceError } from "@/lib/sources/http";
import { datumsSchema, floodCountSchema, floodLevelsSchema, parseDatums, parseFloodCounts, parseFloodLevels, stationListSchema } from "@/lib/sources/metadata";

const fixture = (name: string) => JSON.parse(readFileSync(join(process.cwd(), "tests", "fixtures", name), "utf8"));

describe("CO-OPS predictions", () => {
  it("parses a saved 12-month high/low response", () => {
    const rows = parseHilo(hiloSchema.parse(fixture("predictions-hilo-9414750.json")));
    expect(rows.length).toBeGreaterThan(1400);
    expect(new Set(rows.map((r) => r.type))).toEqual(new Set(["H", "L"]));
    for (const r of rows) expect(Number.isFinite(r.v)).toBe(true);
    for (let i = 1; i < rows.length; i++) expect(rows[i].t).toBeGreaterThan(rows[i - 1].t);
  });

  it("parses a saved 6-minute response on a 6-minute grid", () => {
    const rows = parseCurve(curveSchema.parse(fixture("predictions-6min-9414750.json")));
    expect(rows.length).toBe(1920);
    expect(rows[1].t - rows[0].t).toBe(6 * 60_000);
    expect(rows[rows.length - 1].t - rows[rows.length - 2].t).toBe(6 * 60_000);
  });

  it("rejects a response that lacks predictions", () => {
    expect(hiloSchema.safeParse({ error: { message: "No Predictions data was found" } }).success).toBe(false);
  });

  it("splits long ranges to fit the documented limits", () => {
    expect(chunkDays("2026-11-06", 365, 365)).toEqual([{ begin: "2026-11-06", end: "2027-11-05" }]);
    const parts = chunkDays("2026-11-06", 70, MAX_CURVE_DAYS);
    expect(parts).toHaveLength(3);
    expect(parts[0]).toEqual({ begin: "2026-11-06", end: "2026-12-06" });
    expect(parts[2].end).toBe("2027-01-14");
  });
});

describe("CO-OPS water level", () => {
  it("parses a saved 72-hour response", () => {
    const rows = parseWaterLevel(waterLevelSchema.parse(fixture("water-level-9414750.json")));
    expect(rows.length).toBeGreaterThan(600);
    expect(rows[rows.length - 1].t - rows[0].t).toBeLessThanOrEqual(72 * 3_600_000);
  });

  it("drops gauge dropouts", () => {
    const rows = parseWaterLevel({
      metadata: { id: "1", name: "x", lat: "0", lon: "0" },
      data: [
        { t: "2026-11-06 01:00", v: "4.1" },
        { t: "2026-11-06 01:06", v: "" },
        { t: "2026-11-06 01:12", v: "4.3" },
      ],
    });
    expect(rows.map((r) => r.v)).toEqual([4.1, 4.3]);
  });
});

describe("CO-OPS metadata", () => {
  it("restates Alameda datums above MLLW", () => {
    const d = parseDatums(datumsSchema.parse(fixture("datums-9414750.json")));
    expect(d.mhhw).toBe(6.6);
    expect(d.msl).toBe(3.45);
    expect(d.mllw).toBe(0);
    expect(d.mhhwStnd).toBe(9.93);
    expect(d.epoch).toBe("1983-2001");
  });

  it("restates Alameda flood levels above MHHW", () => {
    const t = parseFloodLevels(floodLevelsSchema.parse(fixture("floodlevels-9414750.json")), 9.93);
    expect(t).toEqual({ minor: 1.9, moderate: 2.82, major: 4.1, nwsMinor: null, action: null });
  });

  it("keeps thresholds null at a gauge that has none", () => {
    const t = parseFloodLevels(floodLevelsSchema.parse(fixture("floodlevels-9414523.json")), 14.94);
    expect(t.minor).toBeNull();
    expect(t.moderate).toBeNull();
    expect(t.major).toBeNull();
    expect(t.action).toBe(1.96);
  });

  it("parses flood day counts from the derived product API", () => {
    const rows = parseFloodCounts(floodCountSchema.parse(fixture("htf-met-year-9414750.json")));
    expect(rows.length).toBeGreaterThan(50);
    expect(rows[rows.length - 1].metYear).toBeGreaterThan(2020);
    for (const r of rows) expect(r.minor).toBeGreaterThanOrEqual(0);
  });

  it("parses the station list", () => {
    const list = stationListSchema.parse(fixture("mdapi-stations-waterlevels-sample.json"));
    expect(list.stations.map((s) => s.id)).toContain("9414750");
  });
});

describe("getJson", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("throws when NOAA answers 200 with an error body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { message: "No data was found" } })));
    await expect(getJson("https://x.test", hiloSchema, { source: "test", retries: 0 })).rejects.toThrow("No data was found");
  });

  it("retries a server error and returns the second answer", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("nope", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ predictions: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getJson("https://x.test", hiloSchema, { source: "test", retries: 1 })).resolves.toEqual({ predictions: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 4xx", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getJson("https://x.test", hiloSchema, { source: "test", retries: 2 })).rejects.toBeInstanceOf(SourceError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
