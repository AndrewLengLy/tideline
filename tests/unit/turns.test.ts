import { describe, expect, it } from "vitest";
import { findTurns } from "@/lib/metrics/turns";

const STEP = 6 * 60_000;

describe("high and low tides", () => {
  // Two days of a mixed tide: a 12.42 h main wave plus a 24.84 h wave, sampled every 6 minutes.
  const n = 480;
  const series = Float32Array.from({ length: n }, (_, i) => {
    const h = (i * STEP) / 3_600_000;
    return 3 + 2 * Math.sin((2 * Math.PI * h) / 12.42) + 0.8 * Math.sin((2 * Math.PI * h) / 24.84);
  });

  it("marks highs and lows that alternate", () => {
    const turns = findTurns(series, STEP);
    expect(turns.length).toBeGreaterThanOrEqual(6);
    for (let i = 1; i < turns.length; i++) expect(turns[i].kind).not.toBe(turns[i - 1].kind);
  });

  it("calls out exactly one highest high and one lowest low", () => {
    const turns = findTurns(series, STEP);
    const peaks = turns.filter((t) => t.peak);
    expect(peaks.map((t) => t.kind).sort()).toEqual(["high", "low"]);
    const highs = turns.filter((t) => t.kind === "high").map((t) => t.value);
    expect(peaks.find((t) => t.kind === "high")!.value).toBe(Math.max(...highs));
  });

  it("skips gaps and the edges of the series", () => {
    const gappy = series.slice();
    for (let i = 100; i < 140; i++) gappy[i] = NaN;
    for (const t of findTurns(gappy, STEP)) {
      expect(Number.isNaN(gappy[t.index])).toBe(false);
      expect(t.index).toBeGreaterThan(5);
      expect(t.index).toBeLessThan(n - 6);
    }
  });
});
