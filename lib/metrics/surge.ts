import { MINUTE } from "../time";
import type { SeriesPoint, SurgeSummary } from "../types";

/** Observed minus predicted, joined on the 6-minute time stamp. Observed points with no matching prediction are dropped. */
export function residualSeries(observed: SeriesPoint[], predicted: SeriesPoint[]): SeriesPoint[] {
  const byTime = new Map(predicted.map((p) => [Math.round(p.t / (6 * MINUTE)), p.v]));
  const out: SeriesPoint[] = [];
  for (const o of observed) {
    const v = byTime.get(Math.round(o.t / (6 * MINUTE)));
    if (v !== undefined) out.push({ t: o.t, v: Number((o.v - v).toFixed(3)) });
  }
  return out;
}

/** Largest residual over the window with its time, plus the most recent reading. */
export function surgeSummary(residual: SeriesPoint[]): SurgeSummary | null {
  if (!residual.length) return null;
  let max = residual[0];
  for (const r of residual) if (r.v > max.v) max = r;
  const last = residual[residual.length - 1];
  return { maxFt: max.v, at: max.t, latestFt: last.v, latestAt: last.t, count: residual.length };
}
