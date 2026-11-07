"use client";

import { scaleBand, scaleLinear } from "d3-scale";
import type { DaysOverRow } from "@/lib/types";
import { ChartFrame } from "./ChartFrame";

interface Props {
  rows: DaysOverRow[];
  height: number;
  stationName: string;
  thresholdLabel: string;
  initialWidth?: number;
}

/** Predicted days over the threshold in the next 12 months, at today's sea level and with 1 to 3 ft added. */
export function DaysOverChart({ rows, height, stationName, thresholdLabel, initialWidth }: Props) {
  const label = `${stationName}: days over ${thresholdLabel}. ${rows.map((r) => `${r.days} days at plus ${r.addFt} feet`).join(", ")}.`;
  return (
    <ChartFrame height={height} label={label} initialWidth={initialWidth} className="w-full">
      {({ w, h }) => {
        const top = 15;
        const bottom = 15;
        const x = scaleBand<number>().domain(rows.map((r) => r.addFt)).range([0, w]).padding(0.22);
        const y = scaleLinear().domain([0, 365]).range([h - bottom, top]);
        return (
          <>
            <line x1={0} x2={w} y1={h - bottom} y2={h - bottom} stroke="#0d2230" strokeWidth={1} />
            {rows.map((r) => (
              <g key={r.addFt}>
                <rect x={x(r.addFt)} width={x.bandwidth()} y={y(r.days)} height={Math.max(0, h - bottom - y(r.days))} fill={r.addFt === 0 ? "#46606f" : "#0077b6"} fillOpacity={0.35 + r.addFt * 0.2} />
                <text x={(x(r.addFt) ?? 0) + x.bandwidth() / 2} y={y(r.days) - 3} textAnchor="middle" fontSize={12} fill="#0d2230" className="num" fontWeight={500}>
                  {r.days}
                </text>
                <text x={(x(r.addFt) ?? 0) + x.bandwidth() / 2} y={h - 3} textAnchor="middle" fontSize={10.5} fill="#46606f" className="num">
                  +{r.addFt} ft
                </text>
              </g>
            ))}
          </>
        );
      }}
    </ChartFrame>
  );
}
