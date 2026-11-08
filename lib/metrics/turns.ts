// High and low tides in a predicted series: every turning point, plus the highest high and the
// lowest low in view.

export interface Turn {
  index: number;
  value: number;
  kind: "high" | "low";
  /** The highest high or lowest low in the series. */
  peak: boolean;
}

/**
 * A frame is a high when nothing within the window on either side is higher, and a low when
 * nothing is lower. A two-hour window on each side skips the small wiggles a mixed tide can show
 * near the turn, and Bay tides never turn twice that fast.
 */
export function findTurns(series: ArrayLike<number>, stepMs: number, windowMs = 2 * 3_600_000): Turn[] {
  const w = Math.max(1, Math.round(windowMs / stepMs));
  const n = series.length;
  const out: Turn[] = [];
  for (let i = 1; i < n - 1; i++) {
    const v = series[i];
    if (Number.isNaN(v)) continue;
    let high = true;
    let low = true;
    let seen = 0;
    for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++) {
      if (j === i || Number.isNaN(series[j])) continue;
      seen++;
      // Ties go to the earlier frame, so a flat top marks once.
      if (series[j] > v || (series[j] === v && j < i)) high = false;
      if (series[j] < v || (series[j] === v && j < i)) low = false;
      if (!high && !low) break;
    }
    // A turn needs water on both sides, so the edges of the series never count.
    if (seen < w || i < w / 2 || i > n - 1 - w / 2) continue;
    if (high) out.push({ index: i, value: v, kind: "high", peak: false });
    else if (low) out.push({ index: i, value: v, kind: "low", peak: false });
  }
  let hi: Turn | null = null;
  let lo: Turn | null = null;
  for (const t of out) {
    if (t.kind === "high" && (!hi || t.value > hi.value)) hi = t;
    if (t.kind === "low" && (!lo || t.value < lo.value)) lo = t;
  }
  if (hi) hi.peak = true;
  if (lo) lo.peak = true;
  return out;
}
