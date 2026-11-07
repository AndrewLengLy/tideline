"use client";

import { useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { area } from "d3-shape";
import { fmtShortDay } from "@/lib/format";
import { addDays, dayStart, pacificDay } from "@/lib/time";
import { type Playhead, usePlayheadIndex } from "../map/playhead";
import { ChartFrame } from "./ChartFrame";

type Values = Float32Array | number[];

interface Props {
  t0: number;
  stepMs: number;
  count: number;
  residual: Values | null;
  playhead?: Playhead;
  height: number;
  stationName: string;
  initialWidth?: number;
  compact?: boolean;
}

function Cursor({ playhead, x, top, bottom }: { playhead: Playhead; x: (i: number) => number; top: number; bottom: number }) {
  const i = usePlayheadIndex(playhead);
  return <line x1={x(i)} x2={x(i)} y1={top} y2={bottom} stroke="#0d2230" strokeWidth={1} />;
}

/** Observed minus predicted, in feet. Above zero, water runs higher than the tide table says. */
export function ResidualChart({ t0, stepMs, count, residual, playhead, height, stationName, initialWidth, compact }: Props) {
  const margin = compact ? { l: 26, r: 8, t: 4, b: 15 } : { l: 34, r: 12, t: 8, b: 20 };
  const peak = useMemo(() => {
    let m = 0.25;
    if (residual) for (const v of residual) if (!Number.isNaN(v)) m = Math.max(m, Math.abs(v));
    return Math.ceil(m * 4) / 4;
  }, [residual]);

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

  return (
    <ChartFrame height={height} label={`${stationName} residual: observed minus predicted water level in feet.`} initialWidth={initialWidth} className="w-full">
      {({ w, h }) => {
        const x = scaleLinear().domain([0, Math.max(1, count - 1)]).range([margin.l, w - margin.r]);
        const y = scaleLinear().domain([-peak, peak]).range([h - margin.b, margin.t]);
        const pts: [number, number][][] = [];
        if (residual) {
          let run: [number, number][] = [];
          for (let i = 0; i < residual.length; i++) {
            const v = residual[i];
            if (Number.isNaN(v)) {
              if (run.length) pts.push(run);
              run = [];
            } else run.push([x(i), y(v)]);
          }
          if (run.length) pts.push(run);
        }
        const gen = area<[number, number]>().x((d) => d[0]).y0(y(0)).y1((d) => d[1]);
        return (
          <>
            {days.map((d) => (
              <g key={d.i}>
                <line x1={x(d.i)} x2={x(d.i)} y1={margin.t} y2={h - margin.b} stroke="#cfdbe1" strokeWidth={0.75} />
                <text x={x(d.i) + 3} y={h - margin.b + 11} fontSize={10} fill="#46606f" className="num">
                  {d.label}
                </text>
              </g>
            ))}
            <line x1={margin.l} x2={w - margin.r} y1={y(0)} y2={y(0)} stroke="#0d2230" strokeWidth={1} />
            <text x={margin.l - 4} y={y(0) + 3.5} fontSize={10} textAnchor="end" fill="#46606f" className="num">
              0
            </text>
            <text x={margin.l - 4} y={y(peak) + 8} fontSize={10} textAnchor="end" fill="#46606f" className="num">
              +{peak}
            </text>
            <text x={margin.l - 4} y={y(-peak)} fontSize={10} textAnchor="end" fill="#46606f" className="num">
              -{peak}
            </text>
            {pts.map((run, i) => (
              <path key={i} d={gen(run) ?? ""} fill="#0077b6" fillOpacity={0.35} stroke="#0077b6" strokeWidth={1} />
            ))}
            {playhead ? <Cursor playhead={playhead} x={x} top={margin.t} bottom={h - margin.b} /> : null}
          </>
        );
      }}
    </ChartFrame>
  );
}
