"use client";

import { memo } from "react";
import Link from "next/link";
import { fmtAsOf, fmtDateTime, ft, plural, signedFt } from "@/lib/format";
import { lineWords } from "@/lib/metrics/days-over";
import { oldPrediction, oldReading, UPDATING_PREDICTION, UPDATING_READING, type Freshness } from "@/lib/metrics/freshness";
import { futureTideEquivalent, kingTideSentence } from "@/lib/metrics/king-tides";
import type { MapStation, MapStationOverview, SurgeSummary } from "@/lib/types";
import { IcsButton } from "./IcsButton";
import { Term } from "./Term";

interface Props {
  station: MapStation;
  overview: MapStationOverview | null;
  now: number;
  asOf: number;
  /** Whether the page's predictions are current, being refreshed, or still old after a refresh. */
  predictionFreshness?: Freshness;
  surge?: SurgeSummary | null;
  surgeAsOf?: number | null;
  surgeFreshness?: Freshness | null;
}

/** An "as of" line that says so when a newer copy is on its way, or how old the copy is when none came. */
function AsOf({ prefix, asOf, now, freshness, updating, old }: { prefix: string; asOf: number; now: number; freshness: Freshness | null | undefined; updating: string; old: (asOf: number, now: number) => string }) {
  if (freshness === "updating") return <p className="mt-1.5 text-[12px] text-muted">{updating}</p>;
  if (freshness === "old") return <p className="mt-1.5 text-[12px] text-coral-ink">{old(asOf, now)}</p>;
  return (
    <p className="mt-1.5 text-[12px] text-muted">
      {prefix}, {fmtAsOf(asOf)}.
    </p>
  );
}

/** Headline numbers for the selected station. Rendered on the server for the default station. */
export const StationSummary = memo(function StationSummary({ station, overview, now, asOf, predictionFreshness, surge, surgeAsOf, surgeFreshness }: Props) {
  const next = overview?.next ?? null;
  const t = station.thresholds;
  return (
    <div className="space-y-4 text-[14px]" data-testid="station-summary">
      <div>
        <h2 className="text-[17px]">{station.name}</h2>
        <p className="text-[13px] text-muted">
          NOAA gauge <span className="num">{station.id}</span>. An <Term term="MHHW" full="mean higher high water">average high tide</Term> sits <span className="num">{ft(station.datums.mhhw)}</span> above an <Term term="MLLW" full="mean lower low water">average low tide</Term>.
        </p>
      </div>

      {next ? (
        <div>
          <p className="text-[13px] text-muted">Next king tide</p>
          <p className="num text-[26px] font-medium leading-tight" data-testid="headline-number">
            {ft(next.height)}
          </p>
          <p className="num text-[13px]">{fmtDateTime(next.t)}</p>
          <p className="mt-1.5">{kingTideSentence(next, now)}</p>
          <div className="mt-2 flex items-center gap-2">
            <IcsButton tide={next} />
            <span className="text-[12.5px] text-muted">Calendar event 30 min before the peak</span>
          </div>
          <AsOf prefix="Prediction from NOAA CO-OPS" asOf={asOf} now={now} freshness={predictionFreshness} updating={UPDATING_PREDICTION} old={oldPrediction} />
        </div>
      ) : (
        <p>NOAA did not answer for this gauge. Tide numbers return on the next refresh.</p>
      )}

      <div>
        <h3 className="text-[14px]">Flood thresholds</h3>
        {t.minor !== null ? (
          <dl className="num mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-[13px]">
            <dt>Minor</dt>
            <dd>{signedFt(t.minor)} above average high tide</dd>
            <dt>Moderate</dt>
            <dd>{t.moderate !== null ? `${signedFt(t.moderate)} above average high tide` : "none published"}</dd>
            <dt>Major</dt>
            <dd>{t.major !== null ? `${signedFt(t.major)} above average high tide` : "none published"}</dd>
          </dl>
        ) : (
          <p className="mt-1 text-[13px]">
            NOAA publishes no high tide flooding thresholds for this gauge.
            {t.action !== null ? (
              <>
                {" "}
                Its action level is <span className="num">{signedFt(t.action)}</span> above an average high tide.
              </>
            ) : null}
          </p>
        )}
      </div>

      {overview?.daysOver.length ? (
        <div>
          <h3 className="text-[14px]">Days the tide reaches the {lineWords(overview.thresholdKind)}, next 12 months</h3>
          <table className="data-table num mt-1 !text-[13px]">
            <thead>
              <tr>
                <th scope="col">Added height</th>
                <th scope="col">Predicted days</th>
              </tr>
            </thead>
            <tbody>
              {overview.daysOver.map((r) => (
                <tr key={r.addFt}>
                  <td>+{r.addFt} ft</td>
                  <td>{plural(r.days, "day")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {surge ? (
        <div>
          <h3 className="text-[14px]">Storm push, last 72 hours</h3>
          <p className="mt-0.5">
            Largest <span title="Residual, or surge">storm push</span> <span className="num">{signedFt(surge.maxFt, 2)}</span> at <span className="num">{fmtDateTime(surge.at)}</span>.
          </p>
          {surgeAsOf ? <AsOf prefix="Measured water level" asOf={surgeAsOf} now={now} freshness={surgeFreshness} updating={UPDATING_READING} old={oldReading} /> : null}
        </div>
      ) : null}

      {next ? (
        <p className="text-[13px] text-muted">
          A king tide of <span className="num">{ft(futureTideEquivalent(next.aboveMhhw))}</span> above an average high tide shows up on the slider as the coral arrow.
        </p>
      ) : null}

      <p className="flex flex-wrap gap-x-3 gap-y-1 text-[14px]">
        <Link className="text-link underline" href={`/stations/${station.slug}`}>
          {station.name} station page
        </Link>
        <Link className="text-link underline" href="/king-tides">
          King tide calendar
        </Link>
      </p>
    </div>
  );
})
