import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell, Stat } from "@/components/PageShell";
import { TideTable } from "@/components/TideTable";
import { getOverview, getStationLive, type StationLive } from "@/lib/data";
import { fmtAsOf, fmtDateTime, fmtShortDay, fmtTime, ft, plural, signedFt } from "@/lib/format";
import { haversineMi } from "@/lib/geo";
import { futureTideEquivalent, kingTideSentence } from "@/lib/metrics/king-tides";
import { stationMeta } from "@/lib/seo";
import { SPOTS } from "@/lib/spots";
import { stationBySlug, STATIONS } from "@/lib/stations";
import { StationCharts } from "./StationCharts";

export const revalidate = 360;
export const dynamicParams = false;

export function generateStaticParams() {
  return STATIONS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const station = stationBySlug(slug);
  if (!station) return {};
  const overview = await getOverview();
  const o = overview.stations.find((s) => s.stationId === station.id);
  const { title, description } = stationMeta(station, o);
  return {
    title,
    description,
    alternates: { canonical: `/stations/${station.slug}` },
    openGraph: { url: `/stations/${station.slug}`, title, description },
    twitter: { title, description },
  };
}

function align(points: { t: number; v: number }[], t0: number, count: number): (number | null)[] {
  const out: (number | null)[] = new Array(count).fill(null);
  for (const p of points) {
    const i = Math.round((p.t - t0) / 360_000);
    if (i >= 0 && i < count) out[i] = p.v;
  }
  return out;
}

export default async function StationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const station = stationBySlug(slug);
  if (!station) notFound();

  const overview = await getOverview();
  const o = overview.stations.find((s) => s.stationId === station.id) ?? null;
  const now = overview.asOf;
  const next = o?.next ?? null;
  const live: StationLive | null = await getStationLive(station.id).catch(() => null);
  const t = station.thresholds;
  const d = station.datums;

  const t0 = live?.observed[0]?.t ?? now;
  const count = live ? Math.round(((live.observed.at(-1)?.t ?? t0) - t0) / 360_000) + 1 : 0;

  const others = STATIONS.filter((s) => s.id !== station.id)
    .map((s) => ({ s, mi: haversineMi(station.lat, station.lng, s.lat, s.lng) }))
    .sort((a, b) => a.mi - b.mi)
    .slice(0, 3);
  const nearSpots = SPOTS.filter((s) => s.nearestStationId === station.id);
  const mapHref = `/?station=${station.id}&lat=${station.lat.toFixed(4)}&lng=${station.lng.toFixed(4)}&z=13.4&pitch=60&bearing=${station.facing}`;
  const recentFloods = station.floodDays.slice(-5);

  return (
    <PageShell>
      <h1 className="text-[30px]">{station.name} tide station</h1>
      <p className="mt-1 text-[15px] text-muted">
        NOAA gauge <span className="num">{station.id}</span>, {station.noaaName}
      </p>
      {next ? <p className="mt-3 max-w-2xl">{kingTideSentence(next, now)}</p> : <p className="mt-3">NOAA did not answer for this gauge. Predictions return on the next refresh.</p>}

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        {next ? <Stat label="Next king tide" value={ft(next.height)} note={`${fmtShortDay(next.t)}, ${fmtTime(next.t)}. Above MLLW.`} testId="headline-number" /> : null}
        {next ? <Stat label="Future-tide equivalent" value={ft(futureTideEquivalent(next.aboveMhhw))} note="Sea level rise that makes it a normal high." /> : null}
        {live?.surge ? <Stat label="Max surge, last 72 hours" value={signedFt(live.surge.maxFt, 2)} note={fmtDateTime(live.surge.at)} /> : null}
      </dl>
      <p className="mt-2 text-[14px] text-muted">Predictions from NOAA CO-OPS, {fmtAsOf(now)}.</p>

      <section className="mt-8">
        <h2 className="text-[22px]">Days over threshold, next 12 months</h2>
        {t.minor === null ? (
          <p className="mt-2 max-w-2xl">
            NOAA publishes no minor, moderate, or major high tide flooding thresholds for this gauge.
            {t.action !== null ? ` The table below counts days over the gauge's action level, ${ft(t.action, 2)} above MHHW. An action level is a watch point, and crossing it does not mean flooding.` : ""}
          </p>
        ) : (
          <p className="mt-2 max-w-2xl">Predicted days with a high tide above NOAA&apos;s minor high tide flooding threshold, {ft(t.minor, 2)} above MHHW. Each row adds that height to every prediction.</p>
        )}
        {o?.daysOver.length ? (
          <table className="data-table num mt-3 max-w-md">
            <thead>
              <tr>
                <th scope="col">Sea level rise added</th>
                <th scope="col">Predicted days</th>
              </tr>
            </thead>
            <tbody>
              {o.daysOver.map((r) => (
                <tr key={r.addFt}>
                  <td>+{r.addFt} ft</td>
                  <td>{plural(r.days, "day")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="mt-8">
        <h2 className="text-[22px]">Last 72 hours</h2>
        {live && live.surge ? (
          <>
            <p className="mt-2 max-w-2xl">
              Observed water level ran as much as <span className="num">{signedFt(live.surge.maxFt, 2)}</span> against the prediction, at <span className="num">{fmtDateTime(live.surge.at)}</span>. The latest residual is <span className="num">{signedFt(live.surge.latestFt, 2)}</span>. Wind and air pressure drive most of a residual. The long-term rise since the 1983 to 2001 datum epoch adds to it.
            </p>
            <div className="mt-3">
              <StationCharts station={station} t0={t0} count={count} observed={align(live.observed, t0, count)} predicted={align(live.predicted, t0, count)} residual={align(live.residual, t0, count)} king={null} />
            </div>
            <p className="mt-1 text-[14px] text-muted">Observed water level from NOAA CO-OPS, {fmtAsOf(live.asOf)}. Preliminary data.</p>
          </>
        ) : (
          <p className="mt-2">The gauge did not answer. Observed readings return when NOAA does.</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-[22px]">Highest tides, next 12 months</h2>
        <p className="mt-2 max-w-2xl">The 20 highest predicted high tides at this gauge, by date.</p>
        {o ? (
          <div className="mt-3">
            <TideTable tides={[...o.kingTides].sort((a, b) => a.t - b.t)} />
          </div>
        ) : null}
      </section>

      <section className="mt-8 grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="text-[22px]">Datums</h2>
          <table className="data-table num mt-3">
            <thead>
              <tr>
                <th scope="col">Datum</th>
                <th scope="col">Feet above MLLW</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>MHHW</td>
                <td>{d.mhhw.toFixed(2)}</td>
              </tr>
              {d.mhw !== null ? (
                <tr>
                  <td>MHW</td>
                  <td>{d.mhw.toFixed(2)}</td>
                </tr>
              ) : null}
              <tr>
                <td>MSL</td>
                <td>{d.msl.toFixed(2)}</td>
              </tr>
              {d.navd88 !== null ? (
                <tr>
                  <td>NAVD88</td>
                  <td>{d.navd88.toFixed(2)}</td>
                </tr>
              ) : null}
              <tr>
                <td>MLLW</td>
                <td>0.00</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-[14px] text-muted">Tidal epoch {d.epoch}. Source: CO-OPS metadata API.</p>
        </div>
        <div>
          <h2 className="text-[22px]">Flood thresholds</h2>
          {t.minor === null ? (
            <p className="mt-3">
              NOAA publishes no high tide flooding thresholds for this gauge.
              {t.action !== null ? (
                <>
                  {" "}
                  Its action level is <span className="num">{ft(t.action, 2)}</span> above MHHW.
                </>
              ) : null}
            </p>
          ) : (
            <table className="data-table num mt-3">
              <thead>
                <tr>
                  <th scope="col">Level</th>
                  <th scope="col">Above MHHW</th>
                  <th scope="col">Above MLLW</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Minor", t.minor],
                    ["Moderate", t.moderate],
                    ["Major", t.major],
                  ] as const
                ).map(([name, v]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{v !== null ? ft(v, 2) : "none"}</td>
                    <td>{v !== null ? ft(v + d.mhhw, 2) : "none"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {t.nwsMinor !== null ? (
            <p className="mt-2 text-[15px]">
              The National Weather Service uses a lower local minor level at this gauge, <span className="num">{ft(t.nwsMinor, 2)}</span> above MHHW.
            </p>
          ) : null}
          {t.minor !== null && recentFloods.length ? (
            <>
              <h3 className="mt-4 text-[16px]">Observed minor flood days</h3>
              <ul className="num mt-1 text-[14px]">
                {recentFloods.map((r) => (
                  <li key={r.metYear}>
                    Met year {r.metYear}: {plural(r.minor, "day")}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[14px] text-muted">Source: CO-OPS derived product API.</p>
            </>
          ) : null}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[22px]">Nearby</h2>
        <ul className="mt-2 space-y-1">
          <li>
            <Link className="text-link underline" href={mapHref}>
              {station.name} on the 3D map
            </Link>
          </li>
          {others.map(({ s, mi }) => (
            <li key={s.id}>
              <Link className="text-link underline" href={`/stations/${s.slug}`}>
                {s.name} tide station
              </Link>{" "}
              <span className="num text-[14px] text-muted">{mi.toFixed(0)} mi</span>
            </li>
          ))}
          {nearSpots.map((s) => (
            <li key={s.slug}>
              <Link className="text-link underline" href={`/spots/${s.slug}`}>
                {s.name}
              </Link>
            </li>
          ))}
          <li>
            <Link className="text-link underline" href="/methodology">
              How these numbers are calculated
            </Link>
          </li>
        </ul>
      </section>
    </PageShell>
  );
}
