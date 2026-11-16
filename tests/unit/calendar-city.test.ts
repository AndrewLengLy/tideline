import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { blockHeight, blockTop, cityLayout, cityPaths, hitTest, monthMarks, weekday } from "@/components/charts/calendar-city";
import { countingThreshold, dailyMaxHighs, daysOverThreshold, floodDaysFromDaily } from "@/lib/metrics/days-over";
import { stationSentence } from "@/lib/metrics/king-tides";
import { hiloSchema, parseHilo } from "@/lib/sources/coops";
import { STATIONS } from "@/lib/stations";
import { addDays, dayStart, HOUR, MINUTE } from "@/lib/time";
import type { HiLo, Station } from "@/lib/types";

const fixture = (name: string) => JSON.parse(readFileSync(join(process.cwd(), "tests", "fixtures", name), "utf8"));

/**
 * A year of mixed semidiurnal highs and lows around a station's own datums, at NOAA's 3 decimals.
 * Each line the counts test (the threshold minus 0 to 3 ft) also gets highs placed 0.001 ft over it
 * and exactly on it, where any rounding slip would show.
 */
function syntheticYear(s: Pick<Station, "datums" | "thresholds">, phase: number): HiLo[] {
  const t0 = dayStart("2026-11-16");
  const step = 6 * MINUTE;
  const n = (365 * 24 * HOUR) / step;
  const w = (hours: number) => (2 * Math.PI) / (hours * HOUR);
  const h = (t: number) =>
    s.datums.msl + 2.0 * Math.cos(w(12.42) * t + phase) + 0.45 * Math.cos(w(12) * t + 2 * phase) + 1.15 * Math.cos(w(23.93) * t + phase / 2) + 0.75 * Math.cos(w(25.82) * t + phase / 3);
  const out: HiLo[] = [];
  let a = h(t0 - step);
  let b = h(t0);
  for (let i = 1; i <= n; i++) {
    const c = h(t0 + i * step);
    if (b > a && b >= c) out.push({ t: t0 + (i - 1) * step, v: Number(b.toFixed(3)), type: "H" });
    if (b < a && b <= c) out.push({ t: t0 + (i - 1) * step, v: Number(b.toFixed(3)), type: "L" });
    a = b;
    b = c;
  }
  const line = countingThreshold(s.thresholds);
  if (line) {
    [0, 1, 2, 3].forEach((add, k) => {
      const L = s.datums.mhhw + line.ft - add;
      // Midnight to 1 AM of an otherwise quiet hour, so these highs are each day's highest only when the line is high.
      out.push({ t: dayStart(addDays("2026-11-16", 40 + k * 2)) + 30 * MINUTE, v: Number((L + 0.001).toFixed(3)), type: "H" });
      out.push({ t: dayStart(addDays("2026-11-16", 41 + k * 2)) + 30 * MINUTE, v: Number(L.toFixed(3)), type: "H" });
    });
  }
  return out.sort((x, y) => x.t - y.t);
}

describe("calendar city flood days", () => {
  it("match daysOverThreshold at +0 to +3 ft for every station", () => {
    for (const [k, s] of STATIONS.entries()) {
      const line = countingThreshold(s.thresholds);
      expect(line, s.name).not.toBeNull();
      const hilo = syntheticYear(s, k * 0.7);
      const daily = dailyMaxHighs(hilo);
      const rows = daysOverThreshold(hilo, s.datums.mhhw, line!.ft);
      for (const r of rows) {
        expect(floodDaysFromDaily(daily.max, r.addFt, s.datums.mhhw, line!.ft), `${s.name} +${r.addFt}`).toBe(r.days);
        // The drawn city counts the same days the counter prints.
        const L = cityLayout({ max: daily.max, start: daily.start, mhhw: s.datums.mhhw, lineFt: line!.ft, w: 420, h: 92 });
        expect(cityPaths(L, { max: daily.max, mhhw: s.datums.mhhw, lineFt: line!.ft }, r.addFt).count, `${s.name} city +${r.addFt}`).toBe(r.days);
      }
      // The counts climb with the slider, or the test data would prove nothing.
      expect(rows[3].days).toBeGreaterThan(rows[0].days);
    }
  });

  it("match daysOverThreshold on NOAA's own Alameda year", () => {
    const hilo = parseHilo(hiloSchema.parse(fixture("predictions-hilo-9414750.json")));
    const s = STATIONS.find((x) => x.id === "9414750")!;
    const line = countingThreshold(s.thresholds)!;
    const daily = dailyMaxHighs(hilo);
    for (const r of daysOverThreshold(hilo, s.datums.mhhw, line.ft)) {
      expect(floodDaysFromDaily(daily.max, r.addFt, s.datums.mhhw, line.ft)).toBe(r.days);
    }
  });

  it("keeps one number per Pacific day at NOAA's 3 decimals", () => {
    const hilo = parseHilo(hiloSchema.parse(fixture("predictions-hilo-9414750.json")));
    const daily = dailyMaxHighs(hilo);
    expect(daily.start).toBe("2026-11-07");
    expect(daily.max.length).toBeGreaterThanOrEqual(365);
    expect(daily.max.length).toBeLessThanOrEqual(367);
    // 5.501 ft survives as 5.501. At 2 decimals it would fall onto a line at 5.50.
    expect(daily.max.some((v) => v !== null && Math.round(v * 1000) % 10 !== 0)).toBe(true);
  });
});

describe("calendar city drawing", () => {
  const s = STATIONS.find((x) => x.id === "9414750")!;
  const hilo = syntheticYear(s, 0.3);
  const daily = dailyMaxHighs(hilo);
  const input = { max: daily.max, start: daily.start, mhhw: s.datums.mhhw, lineFt: 1.9, w: 420, h: 92 };
  const L = cityLayout(input);

  it("fits 53 weeks across and starts on the right weekday", () => {
    expect(weekday("2026-11-16")).toBe(1);
    expect(L.cols).toBe(53);
    expect(L.x0 + L.cols * L.cw).toBeLessThanOrEqual(420);
  });

  it("finds the day under the pointer at each block's top", () => {
    for (const i of [0, 6, 7, 100, 200, daily.max.length - 1]) {
      const v = daily.max[i]!;
      for (const add of [0, 3]) {
        const [x, y] = blockTop(L, i, blockHeight(L, v, s.datums.mhhw, add));
        expect(hitTest(L, input, add, x, y + 1)).toBe(i);
      }
    }
  });

  it("raises every block by the slider height", () => {
    const v = daily.max[10]!;
    expect(blockHeight(L, v, s.datums.mhhw, 3) - blockHeight(L, v, s.datums.mhhw, 0)).toBeCloseTo(3 * L.k, 5);
  });

  it("marks the first day of each month along the top edge", () => {
    const marks = monthMarks(L, daily.start, daily.max.length);
    expect(marks.map((m) => m.label).join("")).toBe("NDJFMAMJJASON".slice(1));
  });
});

describe("header card station sentence", () => {
  const s = STATIONS.find((x) => x.id === "9414750")!;
  const start = "2026-11-16";
  const daily = Array.from({ length: 60 }, (_, i) => (i === 8 ? 7.7 : 6.9 + (i % 5) * 0.1));

  it("names the highest tide for the rest of the month", () => {
    expect(stationSentence("Alameda", daily, start, s.datums.mhhw, Date.UTC(2026, 10, 16, 18))).toBe(
      "Alameda's highest tide for the rest of November is 7.7 ft on Tue Nov 24, about 1 ft above an average high tide.",
    );
  });

  it("looks 30 days ahead once less than a week of the month is left", () => {
    expect(stationSentence("Alameda", daily, start, s.datums.mhhw, Date.UTC(2026, 10, 27, 18))).toMatch(/^Alameda's highest tide in the next 30 days is /);
  });
});
