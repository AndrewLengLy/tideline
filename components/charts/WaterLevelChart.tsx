"use client";

import { useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { fmtDateTime, fmtShortDay } from "@/lib/format";
import { addDays, dayStart, pacificDay } from "@/lib/time";
import type { KingTide, StationThresholds } from "@/lib/types";
import { type Playhead, usePlayheadIndex } from "../map/playhead";
import { ChartFrame } from "./ChartFrame";

type Values = Float32Array | number[];

interface Props {
  t0: number;
  stepMs: number;
  count: number;
  predicted: Values | null;
  observed?: Values | null;
  /** MHHW in feet above MLLW. */
  mhhw: number;
  thresholds: StationThresholds;
  king?: KingTide | null;
  playhead?: Playhead;
  height: number;
  compact?: boolean;
  stationName: string;
  initialWidth?: number;
}

const INK = "#0d2230";
const WATER = "#0077b6";
const CORAL = "#e76f51";
const MUTED = "#46606f";
const LINE = "#cfdbe1";

function extent(vals: (Values | null | undefined)[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const a of vals) {
    if (!a) continue;
    for (const v of a) {
      if (Number.isNaN(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return [lo, hi];
}

function Cursor({ playhead, x, height, top, readout }: { playhead: Playhead; x: (i: number) => number; height: number; top: number; readout: (i: number) => string | null }) {
  const i = usePlayheadIndex(playhead);
  const cx = x(i);
  const label = readout(i);
  return (
    <g data-testid="chart-cursor">
      <line x1={cx} x2={cx} y1={top} y2={height} stroke={INK} strokeWidth={1} />
      {label ? (
        <text x={cx + 4} y={top + 9} fontSize={10.5} fill={INK} className="num">
          {label}
        </text>
      ) : null}
    </g>
  );
}

/** Water level in feet above MLLW: predicted dashed, observed solid, MHHW and flood thresholds as labeled bands. */
export function WaterLevelChart(props: Props) {
  const { t0, stepMs, count, predicted, observed, mhhw, thresholds, king, playhead, height, compact, stationName, initialWidth } = props;
  const minorMllw = thresholds.minor !== null ? mhhw + thresholds.minor : null;
  const moderateMllw = thresholds.moderate !== null ? mhhw + thresholds.moderate : null;

  const [lo, hi] = useMemo(() => extent([predicted, observed]), [predicted, observed]);
  const yMin = Number.isFinite(lo) ? Math.min(lo - 0.3, 0) : 0;
  const yMax = Math.max(Number.isFinite(hi) ? hi + 0.3 : mhhw + 1, (minorMllw ?? mhhw + 1) + 0.35);

  const margin = compact ? { l: 26, r: 8, t: 4, b: 15 } : { l: 34, r: 12, t: 8, b: 20 };

  const days = useMemo(() => {
    const out: { i: number; label: string }[] = [];
    let d = pacificDay(t0);
    for (let k = 0; k < 8; k++) {
      const i = (dayStart(d) - t0) / stepMs;
      if (i >= 0 && i < count) out.push({ i, label: fmtShortDay(dayStart(d) + 12 * 3_600_000).split(",")[0] });
      d = addDays(d, 1);
    }
    return out;
  }, [t0, stepMs, count]);

  const label = `${stationName} water level in feet above MLLW. MHHW is ${mhhw.toFixed(1)} ft${minorMllw !== null ? `, minor flood threshold ${minorMllw.toFixed(1)} ft` : ""}.`;

  return (
    <ChartFrame height={height} label={label} initialWidth={initialWidth} className="w-full">
      {({ w, h }) => {
        const x = scaleLinear().domain([0, Math.max(1, count - 1)]).range([margin.l, w - margin.r]);
        const y = scaleLinear().domain([yMin, yMax]).range([h - margin.b, margin.t]);
        const path = (vals: Values) => {
          const pts: [number, number][] = [];
          for (let i = 0; i < vals.length; i += w < 500 ? 2 : 1) if (!Number.isNaN(vals[i])) pts.push([x(i), y(vals[i])]);
          return line()(pts) ?? "";
        };
        // Observed runs can have holes, so each unbroken run becomes its own segment.
        const observedPath = (vals: Values) => {
          let d = "";
          let open = false;
          for (let i = 0; i < vals.length; i++) {
            const v = vals[i];
            if (Number.isNaN(v)) {
              open = false;
              continue;
            }
            d += `${open ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
            open = true;
          }
          return d;
        };
        const kingIndex = king ? (king.t - t0) / stepMs : -1;
        const showKing = king && kingIndex >= 0 && kingIndex < count;
        const ticks = y.ticks(compact ? 4 : 6);
        return (
          <>
            {minorMllw !== null ? <rect x={margin.l} width={w - margin.l - margin.r} y={margin.t} height={Math.max(0, y(minorMllw) - margin.t)} fill={CORAL} fillOpacity={0.13} /> : null}
            <rect x={margin.l} width={w - margin.l - margin.r} y={minorMllw !== null ? y(minorMllw) : margin.t} height={Math.max(0, y(mhhw) - (minorMllw !== null ? y(minorMllw) : margin.t))} fill={WATER} fillOpacity={0.07} />
            {ticks.map((t) => (
              <g key={t}>
                <line x1={margin.l} x2={w - margin.r} y1={y(t)} y2={y(t)} stroke={LINE} strokeWidth={0.75} />
                <text x={margin.l - 4} y={y(t) + 3.5} fontSize={10} textAnchor="end" fill={MUTED} className="num">
                  {t}
                </text>
              </g>
            ))}
            {days.map((d) => (
              <g key={d.i}>
                <line x1={x(d.i)} x2={x(d.i)} y1={margin.t} y2={h - margin.b} stroke={LINE} strokeWidth={0.75} />
                <text x={x(d.i) + 3} y={h - margin.b + 11} fontSize={10} fill={MUTED} className="num">
                  {d.label}
                </text>
              </g>
            ))}
            <line x1={margin.l} x2={w - margin.r} y1={y(mhhw)} y2={y(mhhw)} stroke={INK} strokeWidth={1} />
            <text x={w - margin.r - 2} y={y(mhhw) + 11} fontSize={10} textAnchor="end" fill={INK} className="num">
              MHHW {mhhw.toFixed(1)}
            </text>
            {minorMllw !== null ? (
              <>
                <line x1={margin.l} x2={w - margin.r} y1={y(minorMllw)} y2={y(minorMllw)} stroke={CORAL} strokeWidth={1} strokeDasharray="4 3" />
                <text x={w - margin.r - 2} y={y(minorMllw) - 3} fontSize={10} textAnchor="end" fill="#a93f25" className="num">
                  minor flood {minorMllw.toFixed(1)}
                </text>
              </>
            ) : null}
            {moderateMllw !== null && moderateMllw < yMax ? (
              <>
                <line x1={margin.l} x2={w - margin.r} y1={y(moderateMllw)} y2={y(moderateMllw)} stroke={CORAL} strokeWidth={1} />
                <text x={margin.l + 3} y={y(moderateMllw) - 3} fontSize={10} fill="#a93f25" className="num">
                  moderate {moderateMllw.toFixed(1)}
                </text>
              </>
            ) : null}
            {predicted ? <path d={path(predicted)} fill="none" stroke={WATER} strokeWidth={1.25} strokeDasharray="3 2.5" /> : null}
            {observed ? <path d={observedPath(observed)} fill="none" stroke={INK} strokeWidth={1.5} data-testid="observed-line" /> : null}
            {showKing ? (
              <g data-testid="chart-king-flag">
                <line x1={x(kingIndex)} x2={x(kingIndex)} y1={y(king.height)} y2={margin.t + 2} stroke={CORAL} strokeWidth={1} />
                <path d={`M${x(kingIndex)} ${margin.t + 2} l9 3.5 l-9 3.5z`} fill={CORAL} stroke={INK} strokeWidth={0.5} />
                <text x={x(kingIndex) + (x(kingIndex) > w - 90 ? -4 : 11)} y={margin.t + 9} textAnchor={x(kingIndex) > w - 90 ? "end" : "start"} fontSize={10} fill="#a93f25" className="num">
                  king tide {king.height.toFixed(1)}
                </text>
              </g>
            ) : null}
            {playhead ? (
              <Cursor
                playhead={playhead}
                x={x}
                top={margin.t}
                height={h - margin.b}
                readout={(i) => {
                  const o = observed ? observed[i] : NaN;
                  const p = predicted ? predicted[i] : NaN;
                  const v = Number.isNaN(o) || o === undefined ? p : o;
                  if (v === undefined || Number.isNaN(v) || compact) return null;
                  return `${v.toFixed(1)} ft, ${fmtDateTime(t0 + i * stepMs)}`;
                }}
              />
            ) : null}
          </>
        );
      }}
    </ChartFrame>
  );
}
