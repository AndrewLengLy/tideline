"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, dayStart, MINUTE } from "@/lib/time";
import type { MapStation, SurgeSummary } from "@/lib/types";

export const STEP_MS = 6 * MINUTE;
export const WINDOW_DAYS = 7;

interface CurveResponse {
  t0: number;
  t: number[];
  v: number[];
}

interface ObservedResponse {
  asOf: number;
  t0: number;
  observed: [number, number][];
  residual: [number, number][];
  surge: SurgeSummary | null;
}

export interface ObservedSeries {
  asOf: number;
  values: Float32Array;
  residual: Float32Array;
  surge: SurgeSummary | null;
}

export interface Frames {
  from: string;
  t0: number;
  count: number;
  predicted: Map<string, Float32Array>;
  observed: Map<string, ObservedSeries>;
  /** Share of requests finished, from 0 to 1. */
  loaded: number;
  failed: string[];
}

/** The 7-day frame grid for a window starting on a Pacific day. */
export function frameGrid(from: string): { t0: number; count: number } {
  const t0 = dayStart(from);
  const end = dayStart(addDays(from, WINDOW_DAYS));
  return { t0, count: Math.round((end - t0) / STEP_MS) };
}

const nan = (n: number) => new Float32Array(n).fill(Number.NaN);

function align(points: [number, number][], t0: number, count: number): Float32Array {
  const out = nan(count);
  for (const [t, v] of points) {
    const i = Math.round((t - t0) / STEP_MS);
    if (i >= 0 && i < count) out[i] = v;
  }
  return out;
}

/** Fills short gaps, such as the repeated hour in November, by straight line. */
function fillGaps(a: Float32Array) {
  let lastGood = -1;
  for (let i = 0; i < a.length; i++) {
    if (Number.isNaN(a[i])) continue;
    if (lastGood >= 0 && i - lastGood > 1 && i - lastGood <= 12) {
      for (let k = lastGood + 1; k < i; k++) a[k] = a[lastGood] + ((a[i] - a[lastGood]) * (k - lastGood)) / (i - lastGood);
    }
    lastGood = i;
  }
}

/**
 * Loads each station once per window. Stations can join the list later, and already loaded ones are kept.
 * @param totalStations how many stations the finished map will hold, for the progress bar
 */
export function useFrames(from: string, stations: MapStation[], totalStations = stations.length): Frames {
  const grid = useMemo(() => frameGrid(from), [from]);
  const [predicted, setPredicted] = useState(() => new Map<string, Float32Array>());
  const [observed, setObserved] = useState(() => new Map<string, ObservedSeries>());
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const curves = useRef(new Map<string, Float32Array>());
  const requested = useRef({ from: "", ids: new Set<string>(), alive: { current: true } });
  const total = totalStations * 2;

  useEffect(() => {
    if (requested.current.from !== from) {
      requested.current.alive.current = false;
      requested.current = { from, ids: new Set(), alive: { current: true } };
      // A new window starts its progress bar from zero.
      setPredicted(new Map());
      setObserved(new Map());
      setDone(0);
      setFailed([]);
    }
    const { alive, ids } = requested.current;
    const finish = () => {
      if (alive.current) setDone((n) => n + 1);
    };

    for (const s of stations) {
      if (ids.has(s.id)) continue;
      ids.add(s.id);
      const key = `${s.id}/${from}`;
      const hit = curves.current.get(key);
      const curve = hit
        ? Promise.resolve(hit)
        : fetch(`/api/curve/${s.id}/${from}`)
            .then((r) => {
              if (!r.ok) throw new Error(String(r.status));
              return r.json() as Promise<CurveResponse>;
            })
            .then((j) => {
              const values = align(
                j.t.map((m, i) => [j.t0 + m * MINUTE, j.v[i]]),
                grid.t0,
                grid.count,
              );
              fillGaps(values);
              curves.current.set(key, values);
              return values;
            });

      curve
        .then((values) => {
          if (alive.current) setPredicted((prev) => new Map(prev).set(s.id, values));
        })
        .catch(() => {
          if (alive.current) setFailed((f) => [...f, s.id]);
        })
        .finally(finish);

      fetch(`/api/observed/${s.id}`)
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json() as Promise<ObservedResponse>;
        })
        .then((j) => {
          if (!alive.current) return;
          const abs = (rows: [number, number][]) => rows.map(([m, v]) => [j.t0 + m * MINUTE, v] as [number, number]);
          setObserved((prev) =>
            new Map(prev).set(s.id, {
              asOf: j.asOf,
              values: align(abs(j.observed), grid.t0, grid.count),
              residual: align(abs(j.residual), grid.t0, grid.count),
              surge: j.surge,
            }),
          );
        })
        .catch(() => undefined)
        .finally(finish);
    }
  }, [from, stations, grid]);

  return { from, t0: grid.t0, count: grid.count, predicted, observed, loaded: total ? Math.min(1, done / total) : 1, failed };
}

/** Water level at a fractional frame, in feet above MLLW. Observed readings win over predictions when both exist. */
export function levelAt(frames: Frames, stationId: string, pos: number): { value: number; kind: "observed" | "predicted" } | null {
  const i = Math.max(0, Math.min(frames.count - 1, Math.floor(pos)));
  const j = Math.min(frames.count - 1, i + 1);
  const f = pos - i;
  const read = (a: Float32Array | undefined) => {
    if (!a) return null;
    const x = a[i];
    const y = a[j];
    if (Number.isNaN(x)) return null;
    return Number.isNaN(y) ? x : x + (y - x) * f;
  };
  const o = read(frames.observed.get(stationId)?.values);
  if (o !== null) return { value: o, kind: "observed" };
  const p = read(frames.predicted.get(stationId));
  return p === null ? null : { value: p, kind: "predicted" };
}
