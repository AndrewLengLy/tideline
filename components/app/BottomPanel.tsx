"use client";

import { fmtAsOf, fmtDateTime, signedFt } from "@/lib/format";
import type { DaysOverRow, KingTide, MapStation, SurgeSummary } from "@/lib/types";
import { DaysOverChart } from "../charts/DaysOverChart";
import { ResidualChart } from "../charts/ResidualChart";
import { WaterLevelChart } from "../charts/WaterLevelChart";
import type { Playhead } from "../map/playhead";

interface ChartsProps {
  station: MapStation;
  t0: number;
  stepMs: number;
  count: number;
  predicted: Float32Array | null;
  observed: Float32Array | null;
  residual: Float32Array | null;
  surge: SurgeSummary | null;
  observedAsOf: number | null;
  king: KingTide | null;
  daysOver: DaysOverRow[];
  thresholdLabel: string;
  overviewAsOf: number;
  playhead: Playhead;
  chartHeight: number;
  layoutClass: string;
}

function Skeleton({ height }: { height: number }) {
  return <div className="skeleton w-full" style={{ height }} data-testid="chart-skeleton" />;
}

/** The three small charts: 7-day water level, residual, and days over threshold. */
export function MiniCharts({ station, t0, stepMs, count, predicted, observed, residual, surge, observedAsOf, king, daysOver, thresholdLabel, overviewAsOf, playhead, chartHeight, layoutClass }: ChartsProps) {
  return (
    <div className={layoutClass}>
      <figure className="min-w-0">
        <figcaption className="flex items-baseline justify-between gap-2 text-[12.5px]">
          <span className="font-bold">Water level, ft above MLLW</span>
          <span className="num truncate text-[11px] text-muted">{observedAsOf ? fmtAsOf(observedAsOf) : "predicted"}</span>
        </figcaption>
        {predicted ? (
          <WaterLevelChart t0={t0} stepMs={stepMs} count={count} predicted={predicted} observed={observed} mhhw={station.datums.mhhw} thresholds={station.thresholds} king={king} playhead={playhead} height={chartHeight} compact stationName={station.name} />
        ) : (
          <Skeleton height={chartHeight} />
        )}
        <p className="text-[11px] leading-tight text-muted">Dashed predicted, solid observed. NOAA CO-OPS.</p>
      </figure>
      <figure className="min-w-0">
        <figcaption className="flex items-baseline justify-between gap-2 text-[12.5px]">
          <span className="font-bold">Residual (surge), ft</span>
          <span className="num truncate text-[11px] text-muted">{surge ? `max ${signedFt(surge.maxFt, 2)}` : ""}</span>
        </figcaption>
        {predicted ? <ResidualChart t0={t0} stepMs={stepMs} count={count} residual={residual} playhead={playhead} height={chartHeight} compact stationName={station.name} /> : <Skeleton height={chartHeight} />}
        <p className="truncate text-[11px] leading-tight text-muted">{surge ? `Observed minus predicted. Peak ${fmtDateTime(surge.at)}.` : "Observed minus predicted, last 72 hours."}</p>
      </figure>
      <figure className="min-w-0">
        <figcaption className="flex items-baseline justify-between gap-2 text-[12.5px]">
          <span className="truncate font-bold">Days over {thresholdLabel}, next 12 mo</span>
        </figcaption>
        {daysOver.length ? (
          <DaysOverChart rows={daysOver} height={chartHeight} stationName={station.name} thresholdLabel={thresholdLabel} />
        ) : (
          <p className="pt-2 text-[12.5px]" style={{ height: chartHeight }}>
            NOAA publishes no threshold for this gauge, so this count is blank.
          </p>
        )}
        <p className="truncate text-[11px] leading-tight text-muted">Predicted highs plus added height, {fmtAsOf(overviewAsOf)}.</p>
      </figure>
    </div>
  );
}
