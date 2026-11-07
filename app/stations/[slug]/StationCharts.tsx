"use client";

import { ResidualChart } from "@/components/charts/ResidualChart";
import { WaterLevelChart } from "@/components/charts/WaterLevelChart";
import type { KingTide, Station } from "@/lib/types";

const STEP = 6 * 60_000;

interface Props {
  station: Station;
  t0: number;
  count: number;
  observed: (number | null)[];
  predicted: (number | null)[];
  residual: (number | null)[];
  king: KingTide | null;
}

const toValues = (a: (number | null)[]) => a.map((v) => (v === null ? Number.NaN : v));

/** The last 72 hours at this gauge. Rendered on the server at a set width, then measured in the browser. */
export function StationCharts({ station, t0, count, observed, predicted, residual, king }: Props) {
  return (
    <div className="space-y-5">
      <figure>
        <figcaption className="text-[15px] font-bold">Water level, feet above MLLW</figcaption>
        <WaterLevelChart t0={t0} stepMs={STEP} count={count} predicted={toValues(predicted)} observed={toValues(observed)} mhhw={station.datums.mhhw} thresholds={station.thresholds} king={king} height={230} stationName={station.name} initialWidth={760} />
        <p className="text-[14px] text-muted">Dashed line predicted, solid line observed.</p>
      </figure>
      <figure>
        <figcaption className="text-[15px] font-bold">Residual, feet (observed minus predicted)</figcaption>
        <ResidualChart t0={t0} stepMs={STEP} count={count} residual={toValues(residual)} height={140} stationName={station.name} initialWidth={760} />
      </figure>
    </div>
  );
}
