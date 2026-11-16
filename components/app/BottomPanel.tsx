"use client";

import { memo } from "react";
import { fmtAsOf, signedFt } from "@/lib/format";
import { lineWords } from "@/lib/metrics/days-over";
import { oldReading, UPDATING_READING, type Freshness } from "@/lib/metrics/freshness";
import type { KingTide, MapStation, SurgeSummary } from "@/lib/types";
import { CalendarCity } from "../charts/CalendarCity";
import { ResidualChart } from "../charts/ResidualChart";
import { WaterLevelChart } from "../charts/WaterLevelChart";
import type { Playhead } from "../map/playhead";
import { Term } from "./Term";

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
  observedFreshness: Freshness | null;
  king: KingTide | null;
  /** Highest predicted high per Pacific day, feet above average low tide. */
  dailyMax: (number | null)[];
  dailyStart: string;
  /** The counting line, NOAA's minor threshold or the action level, in feet above average high tide. */
  line: { kind: "minor" | "action"; ft: number } | null;
  /** The water slider, in feet. */
  addFt: number;
  /** Clock time when the page booted, for the age of an old reading. */
  now: number;
  playhead: Playhead;
  chartHeight: number;
  layoutClass: string;
}

function Skeleton({ height }: { height: number }) {
  return <div className="skeleton w-full" style={{ height }} data-testid="chart-skeleton" />;
}

/** The label beside the water level title: the reading's time, or that a newer one is on its way. */
function ReadingLabel({ asOf, freshness }: { asOf: number | null; freshness: Freshness | null }) {
  if (!asOf) return <span className="num truncate text-[11px] text-muted">predicted</span>;
  if (freshness === "updating") {
    return (
      <span className="truncate text-[11px] text-muted" data-testid="reading-label">
        {UPDATING_READING}
      </span>
    );
  }
  return (
    <span className={`num truncate text-[11px] ${freshness === "old" ? "text-coral-ink" : "text-muted"}`} data-testid="reading-label">
      {fmtAsOf(asOf)}
    </span>
  );
}

/** The three small charts: 7-day water level, storm push, and the calendar city. */
export const MiniCharts = memo(function MiniCharts({ station, t0, stepMs, count, predicted, observed, residual, surge, observedAsOf, observedFreshness, king, dailyMax, dailyStart, line, addFt, now, playhead, chartHeight, layoutClass }: ChartsProps) {
  const old = observedAsOf !== null && observedFreshness === "old";
  return (
    <div className={layoutClass}>
      <figure className="min-w-0">
        <figcaption className="flex items-baseline justify-between gap-2 text-[12.5px]">
          <span className="shrink-0 font-bold">
            Water level, ft above <Term term="MLLW" full="mean lower low water">average low tide</Term>
          </span>
          <ReadingLabel asOf={observedAsOf} freshness={observedFreshness} />
        </figcaption>
        {predicted ? (
          <WaterLevelChart t0={t0} stepMs={stepMs} count={count} predicted={predicted} observed={observed} mhhw={station.datums.mhhw} thresholds={station.thresholds} king={king} playhead={playhead} height={chartHeight} compact stationName={station.name} />
        ) : (
          <Skeleton height={chartHeight} />
        )}
        {old ? (
          <p className="truncate text-[11px] leading-tight text-coral-ink" data-testid="reading-warning">
            {oldReading(observedAsOf, Math.max(now, observedAsOf))}
          </p>
        ) : (
          <p className="truncate text-[11px] leading-tight text-muted">Dashed predicted, solid measured. NOAA CO-OPS.</p>
        )}
      </figure>
      <figure className="min-w-0">
        <figcaption className="flex items-baseline justify-between gap-2 text-[12.5px]">
          <span className="font-bold" title="Residual, or surge">
            Storm push, ft
          </span>
          <span className="num truncate text-[11px] text-muted">{surge ? `max ${signedFt(surge.maxFt, 2)}` : ""}</span>
        </figcaption>
        {predicted ? <ResidualChart t0={t0} stepMs={stepMs} count={count} residual={residual} playhead={playhead} height={chartHeight - 13} compact stationName={station.name} /> : <Skeleton height={chartHeight - 13} />}
        <p className="text-[11px] leading-tight text-muted">Measured minus predicted. Above zero means wind or low pressure is piling water up.</p>
      </figure>
      <figure className="min-w-0">
        <figcaption className="text-[12.5px]">
          <span className="block truncate font-bold">Days the tide reaches the {lineWords(line?.kind ?? null)}, next 12 months</span>
        </figcaption>
        {line && dailyMax.length ? (
          <CalendarCity dailyMax={dailyMax} dailyStart={dailyStart} mhhw={station.datums.mhhw} line={line} addFt={addFt} stationName={station.name} height={chartHeight - 12} />
        ) : (
          <p className="pt-2 text-[12.5px]" style={{ height: chartHeight }}>
            {line ? "Predictions for this gauge are unavailable right now." : "NOAA publishes no flood line for this gauge, so this calendar is blank."}
          </p>
        )}
      </figure>
    </div>
  );
})
