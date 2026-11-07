import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { countingThreshold, daysOverForStation, daysOverThreshold } from "@/lib/metrics/days-over";
import { buildIcs, icsFileName } from "@/lib/metrics/ics";
import { aboveMhhw, bayCalendar, futureTideEquivalent, highestTides, kingTideSentence, nextTide } from "@/lib/metrics/king-tides";
import { residualSeries, surgeSummary } from "@/lib/metrics/surge";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";
import { curveSchema, hiloSchema, parseCurve, parseHilo, parseWaterLevel, waterLevelSchema } from "@/lib/sources/coops";
import type { HiLo, KingTide, Station } from "@/lib/types";

const fixture = (name: string) => JSON.parse(readFileSync(join(process.cwd(), "tests", "fixtures", name), "utf8"));
const hilo = parseHilo(hiloSchema.parse(fixture("predictions-hilo-9414750.json")));

const ALAMEDA = {
  id: "9414750",
  name: "Alameda",
  slug: "alameda",
  datums: { epoch: "1983-2001", mhhw: 6.6, mhw: 6.0, msl: 3.45, mlw: 1.0, mllw: 0, navd88: 0.23 },
  thresholds: { minor: 1.9, moderate: 2.82, major: 4.1, nwsMinor: null, action: null },
} satisfies Pick<Station, "id" | "name" | "slug" | "datums" | "thresholds">;

const tide = (over: Partial<KingTide>): KingTide => ({
  stationId: "9414750",
  stationName: "Alameda",
  stationSlug: "alameda",
  t: Date.UTC(2026, 11, 26, 18, 0),
  height: 7.8,
  aboveMhhw: 1.2,
  ...over,
});

describe("king tide list", () => {
  const list = highestTides(hilo, ALAMEDA);

  it("takes the 20 highest highs, highest first", () => {
    expect(list).toHaveLength(20);
    for (let i = 1; i < list.length; i++) expect(list[i - 1].aboveMhhw).toBeGreaterThanOrEqual(list[i].aboveMhhw);
    expect(list[0].aboveMhhw).toBeGreaterThan(1);
    const lows = new Set(hilo.filter((h) => h.type === "L").map((h) => h.t));
    for (const k of list) expect(lows.has(k.t)).toBe(false);
  });

  it("measures height above MHHW", () => {
    expect(aboveMhhw(7.8, 6.6)).toBe(1.2);
    expect(list[0].aboveMhhw).toBeCloseTo(list[0].height - 6.6, 3);
  });

  it("finds the earliest upcoming tide", () => {
    const a = tide({ t: 100 });
    const b = tide({ t: 300 });
    const c = tide({ t: 200 });
    expect(nextTide([a, b, c], 150)).toBe(c);
    expect(nextTide([a], 150)).toBeNull();
  });

  it("ranks the Bay calendar by height and lists it by date", () => {
    const cal = bayCalendar([[tide({ t: 300, aboveMhhw: 1.5 }), tide({ t: 100, aboveMhhw: 1.1 })], [tide({ t: 200, aboveMhhw: 1.3 })]], 2);
    expect(cal.map((k) => k.t)).toEqual([200, 300]);
  });
});

describe("future-tide equivalent", () => {
  it("rounds to a tenth and never goes below zero", () => {
    expect(futureTideEquivalent(1.249)).toBe(1.2);
    expect(futureTideEquivalent(-0.4)).toBe(0);
  });

  it("writes the brief's sentence", () => {
    const now = Date.UTC(2026, 11, 22, 18, 0);
    expect(kingTideSentence(tide({}), now)).toBe("Saturday's 7.8 ft high at Alameda sits 1.2 ft above MHHW. With 1.2 ft of sea level rise, that becomes a normal high tide.");
  });

  it("names the date when the tide is more than a week out", () => {
    expect(kingTideSentence(tide({}), Date.UTC(2026, 10, 6))).toMatch(/^Dec 26's 7\.8 ft high/);
  });

  it("says so when a high stays at or below MHHW", () => {
    expect(kingTideSentence(tide({ aboveMhhw: -0.2, height: 6.4 }), Date.UTC(2026, 10, 6))).toContain("stays at or below MHHW");
  });
});

describe("days over threshold", () => {
  const h = (day: number, hour: number, v: number, type: "H" | "L" = "H"): HiLo => ({ t: Date.UTC(2026, 11, day, hour), v, type });

  it("counts calendar days once when two highs clear the bar", () => {
    const rows = daysOverThreshold([h(10, 18, 9), h(11, 6, 9)], 6.6, 1.9, [0]);
    expect(rows).toEqual([{ addFt: 0, days: 1 }]);
  });

  it("ignores lows and treats the threshold as strictly greater", () => {
    expect(daysOverThreshold([h(10, 18, 9, "L")], 6.6, 1.9, [0])[0].days).toBe(0);
    expect(daysOverThreshold([h(10, 18, 8.5)], 6.6, 1.9, [0])[0].days).toBe(0);
    expect(daysOverThreshold([h(10, 18, 8.51)], 6.6, 1.9, [0])[0].days).toBe(1);
  });

  it("adds height to every prediction on the recounts", () => {
    const rows = daysOverThreshold([h(10, 18, 7), h(12, 18, 6)], 6.6, 1.9);
    expect(rows).toEqual([
      { addFt: 0, days: 0 },
      { addFt: 1, days: 0 },
      { addFt: 2, days: 1 },
      { addFt: 3, days: 2 },
    ]);
  });

  it("never falls as the added height grows, on real predictions", () => {
    const rows = daysOverForStation(hilo, ALAMEDA);
    expect(rows.map((r) => r.addFt)).toEqual([0, 1, 2, 3]);
    for (let i = 1; i < rows.length; i++) expect(rows[i].days).toBeGreaterThanOrEqual(rows[i - 1].days);
    expect(rows[3].days).toBeGreaterThan(rows[0].days);
  });

  it("prefers the minor threshold and falls back to the action level", () => {
    expect(countingThreshold(ALAMEDA.thresholds)).toEqual({ kind: "minor", ft: 1.9 });
    expect(countingThreshold({ minor: null, moderate: null, major: null, nwsMinor: null, action: 1.96 })).toEqual({ kind: "action", ft: 1.96 });
    expect(countingThreshold({ minor: null, moderate: null, major: null, nwsMinor: null, action: null })).toBeNull();
  });
});

describe("surge", () => {
  const t0 = Date.UTC(2026, 10, 6, 0, 0);
  const step = 6 * 60_000;

  it("subtracts prediction from observation at matching times", () => {
    const res = residualSeries(
      [
        { t: t0, v: 5 },
        { t: t0 + step, v: 5.5 },
        { t: t0 + 2 * step, v: 6 },
      ],
      [
        { t: t0, v: 4.5 },
        { t: t0 + 2 * step, v: 6.25 },
      ],
    );
    expect(res).toEqual([
      { t: t0, v: 0.5 },
      { t: t0 + 2 * step, v: -0.25 },
    ]);
  });

  it("reports the largest residual with its time", () => {
    const s = surgeSummary([
      { t: 1, v: 0.1 },
      { t: 2, v: 0.8 },
      { t: 3, v: -0.2 },
    ]);
    expect(s).toEqual({ maxFt: 0.8, at: 2, latestFt: -0.2, latestAt: 3, count: 3 });
    expect(surgeSummary([])).toBeNull();
  });

  it("joins the saved observed and predicted responses", () => {
    const observed = parseWaterLevel(waterLevelSchema.parse(fixture("water-level-9414750.json")));
    const predicted = parseCurve(curveSchema.parse(fixture("predictions-6min-9414750.json")));
    const res = residualSeries(observed, predicted);
    expect(res.length).toBeGreaterThan(300);
    for (const r of res) expect(Math.abs(r.v)).toBeLessThan(5);
  });
});

describe("calendar export", () => {
  const k = tide({ t: Date.UTC(2026, 11, 24, 19, 9), height: 7.925, aboveMhhw: 1.325 });
  const ics = buildIcs(k, Date.UTC(2026, 10, 6));

  it("starts 30 minutes before the peak", () => {
    expect(ics).toContain("DTSTART:20261224T183900Z");
    expect(ics).toContain("DTEND:20261224T193900Z");
  });

  it("uses CRLF and folds long lines at 75 octets", () => {
    expect(ics.endsWith("\r\n")).toBe(true);
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });

  it("escapes commas in text fields and names the file by station and date", () => {
    expect(ics).toContain("SUMMARY:King tide at Alameda\\, 7.9 ft");
    expect(icsFileName(k)).toBe("king-tide-alameda-2026-12-24.ics");
  });
});

describe("rate limit", () => {
  it("blocks past the limit and recovers after the window", () => {
    resetRateLimits();
    const now = 1_000_000;
    expect(rateLimit("ip", 2, 60_000, now).ok).toBe(true);
    expect(rateLimit("ip", 2, 60_000, now + 1).ok).toBe(true);
    const blocked = rateLimit("ip", 2, 60_000, now + 2);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(rateLimit("other", 2, 60_000, now + 2).ok).toBe(true);
    expect(rateLimit("ip", 2, 60_000, now + 61_000).ok).toBe(true);
  });
});
