"use client";

import Link from "next/link";
import { fmtAsOf, fmtDateTime, ft, plural, signedFt } from "@/lib/format";
import { futureTideEquivalent, kingTideSentence } from "@/lib/metrics/king-tides";
import type { MapStation, MapStationOverview, SurgeSummary } from "@/lib/types";
import { IcsButton } from "./IcsButton";

interface Props {
  station: MapStation;
  overview: MapStationOverview | null;
  now: number;
  asOf: number;
  surge?: SurgeSummary | null;
  surgeAsOf?: number | null;
}

/** Headline numbers for the selected station. Rendered on the server for the default station. */
export function StationSummary({ station, overview, now, asOf, surge, surgeAsOf }: Props) {
  const next = overview?.next ?? null;
  const t = station.thresholds;
  return (
    <div className="space-y-4 text-[14px]" data-testid="station-summary">
      <div>
        <h2 className="text-[17px]">{station.name}</h2>
        <p className="text-[13px] text-muted">
          NOAA gauge <span className="num">{station.id}</span>, MHHW <span className="num">{ft(station.datums.mhhw)}</span> above MLLW
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
          <p className="mt-1.5 text-[12px] text-muted">Prediction from NOAA CO-OPS, {fmtAsOf(asOf)}.</p>
        </div>
      ) : (
        <p>NOAA did not answer for this gauge. Tide numbers return on the next refresh.</p>
      )}

      <div>
        <h3 className="text-[14px]">Flood thresholds</h3>
        {t.minor !== null ? (
          <dl className="num mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-[13px]">
            <dt>Minor</dt>
            <dd>{signedFt(t.minor)} above MHHW</dd>
            <dt>Moderate</dt>
            <dd>{t.moderate !== null ? `${signedFt(t.moderate)} above MHHW` : "none published"}</dd>
            <dt>Major</dt>
            <dd>{t.major !== null ? `${signedFt(t.major)} above MHHW` : "none published"}</dd>
          </dl>
        ) : (
          <p className="mt-1 text-[13px]">
            NOAA publishes no high tide flooding thresholds for this gauge.
            {t.action !== null ? (
              <>
                {" "}
                Its action level is <span className="num">{signedFt(t.action)}</span> above MHHW.
              </>
            ) : null}
          </p>
        )}
      </div>

      {overview?.daysOver.length ? (
        <div>
          <h3 className="text-[14px]">Days over {overview.thresholdKind === "minor" ? "minor threshold" : "action level"}, next 12 months</h3>
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
          <h3 className="text-[14px]">Surge, last 72 hours</h3>
          <p className="mt-0.5">
            Largest residual <span className="num">{signedFt(surge.maxFt, 2)}</span> at <span className="num">{fmtDateTime(surge.at)}</span>.
          </p>
          {surgeAsOf ? <p className="text-[12px] text-muted">Observed water level, {fmtAsOf(surgeAsOf)}.</p> : null}
        </div>
      ) : null}

      {next ? (
        <p className="text-[13px] text-muted">
          A king tide of <span className="num">{ft(futureTideEquivalent(next.aboveMhhw))}</span> above MHHW shows up on the slider as the coral arrow.
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
}
