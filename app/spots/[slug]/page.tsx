import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell, Stat } from "@/components/PageShell";
import { TideTable } from "@/components/TideTable";
import { getOverview } from "@/lib/data";
import { stepColor } from "@/lib/colors";
import { fmtAsOf, fmtDate, fmtShortDay, fmtTime, ft, milesAway } from "@/lib/format";
import { haversineMi } from "@/lib/geo";
import { futureTideEquivalent } from "@/lib/metrics/king-tides";
import { spotMeta } from "@/lib/seo";
import { LINKS } from "@/lib/site";
import { spotBySlug, SPOTS, SPOTS_CHECKED_AT } from "@/lib/spots";
import { stationById } from "@/lib/stations";
import type { SlrStatus } from "@/lib/types";

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return SPOTS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const spot = spotBySlug(slug);
  if (!spot) return {};
  const overview = await getOverview();
  const o = overview.stations.find((s) => s.stationId === spot.nearestStationId);
  const { title, description } = spotMeta(spot, o, stationById(spot.nearestStationId)?.name ?? "");
  return {
    title,
    description,
    alternates: { canonical: `/spots/${spot.slug}` },
    openGraph: { url: `/spots/${spot.slug}`, title, description },
    twitter: { title, description },
  };
}

const STATUS_LABEL: Record<SlrStatus, string> = { dry: "dry", "low-lying": "low-lying", flooded: "flooded", water: "open water" };

/** The foot value prints above the swatch, and the status prints below, so color carries nothing alone. */
function StepCell({ ft: step, status }: { ft: number; status: SlrStatus }) {
  const flooded = status === "flooded" || status === "water";
  const style: React.CSSProperties = flooded ? { background: stepColor(step) } : status === "low-lying" ? { backgroundImage: "radial-gradient(#46606f 1px, transparent 1.2px)", backgroundSize: "6px 6px" } : {};
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="num text-[14px] font-medium">{step}</span>
      <div className="h-7 w-full rounded-sm border border-line" style={style} />
      <span className="text-[12px] leading-tight text-muted">{STATUS_LABEL[status]}</span>
    </div>
  );
}

export default async function SpotPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const spot = spotBySlug(slug);
  if (!spot) notFound();

  const overview = await getOverview();
  const station = stationById(spot.nearestStationId)!;
  const o = overview.stations.find((s) => s.stationId === spot.nearestStationId) ?? null;
  const next = o?.next ?? null;
  const eq = next ? futureTideEquivalent(next.aboveMhhw) : null;
  const upcoming = o ? [...o.kingTides].filter((k) => k.t >= overview.asOf).sort((a, b) => a.t - b.t).slice(0, 8) : [];

  const nearby = SPOTS.filter((s) => s.slug !== spot.slug)
    .map((s) => ({ s, mi: haversineMi(spot.lat, spot.lng, s.lat, s.lng) }))
    .sort((a, b) => a.mi - b.mi)
    .slice(0, 3);
  const mapHref = `/?station=${station.id}&lat=${spot.lat.toFixed(4)}&lng=${spot.lng.toFixed(4)}&z=14.2&pitch=60&bearing=${spot.facing}${spot.firstFloodFt !== null ? `&ft=${spot.firstFloodFt}` : ""}`;

  let gap: string | null = null;
  if (spot.firstFloodFt !== null && eq !== null) {
    gap =
      spot.firstFloodFt <= Math.round(eq)
        ? `NOAA's layer already reaches this spot at the height of the next king tide, ${ft(eq)} above MHHW at the ${station.name} gauge.`
        : `That is ${ft(spot.firstFloodFt - eq)} above the next king tide, which sits ${ft(eq)} above MHHW at the ${station.name} gauge.`;
  }

  const belowLayer = spot.floodingReported && eq !== null && (spot.firstFloodFt === null || spot.firstFloodFt > Math.round(eq));

  return (
    <PageShell>
      <h1 className="text-[30px]">{spot.name}</h1>
      <p className="mt-3 max-w-2xl">{spot.fact}</p>
      <p className="mt-1 text-[14px] text-muted">
        Source:{" "}
        <a className="text-link underline" href={spot.sourceUrl}>
          {spot.sourceName}
        </a>
      </p>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <Stat label="First floods on NOAA's layer at" value={spot.firstFloodFt === null ? "above 10 ft" : ft(spot.firstFloodFt, 0)} note="Sea level rise above today's MHHW." testId="headline-number" />
        {next ? <Stat label={`Next king tide, ${station.name} gauge`} value={ft(next.height)} note={`${fmtShortDay(next.t)}, ${fmtTime(next.t)}. ${milesAway(spot.nearestStationMi)} from this spot.`} /> : null}
      </dl>
      {gap ? <p className="mt-3 max-w-2xl">{gap}</p> : null}
      {belowLayer ? (
        <p className="mt-2 max-w-2xl" data-testid="layer-gap">
          The source above reports water here at king tides, below the step on NOAA&apos;s layer. Screening layers can miss low curbs and storm drains, and they leave out wind and waves.
        </p>
      ) : null}
      {spot.firstLowLyingFt !== null && (spot.firstFloodFt === null || spot.firstLowLyingFt < spot.firstFloodFt) ? (
        <p className="mt-2 max-w-2xl">
          NOAA marks this point as low-lying from <span className="num">{ft(spot.firstLowLyingFt, 0)}</span>. It sits below the water level at that step, with no mapped path to the Bay.
        </p>
      ) : null}

      <section className="mt-7">
        <h2 className="text-[22px]">NOAA layer at this point, by foot of sea level rise</h2>
        <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-11" data-testid="step-ladder">
          {spot.steps.map((status, i) => (
            <StepCell key={i} ft={i} status={status} />
          ))}
        </div>
        <p className="mt-2 text-[14px] text-muted">
          Point query against NOAA SLR Viewer tiles{SPOTS_CHECKED_AT ? `, as of ${fmtDate(SPOTS_CHECKED_AT)}` : ""}. Screening-level. Verify on site.
        </p>
      </section>

      <section className="mt-7">
        <h2 className="text-[22px]">King tide times from the {station.name} gauge</h2>
        <p className="mt-2 max-w-2xl">
          The nearest active gauge sits <span className="num">{milesAway(spot.nearestStationMi)}</span> away, so the local peak can arrive earlier or later and run higher or lower. Plan to arrive early.
        </p>
        {upcoming.length ? (
          <div className="mt-3">
            <TideTable tides={upcoming} />
          </div>
        ) : (
          <p className="mt-2">NOAA did not answer for this gauge. Times return on the next refresh.</p>
        )}
        <p className="mt-2 text-[14px] text-muted">Heights in feet above MLLW. Predictions from NOAA CO-OPS, {fmtAsOf(overview.asOf)}.</p>
      </section>

      <section className="mt-7 max-w-2xl">
        <h2 className="text-[22px]">Share what you see</h2>
        <p className="mt-2">
          Photos from this shoreline feed the record of what flooding looks like here. Send yours through the{" "}
          <a className="text-link underline" href={LINKS.kingTidesUpload}>
            California King Tides Project upload form
          </a>
          . Stay off wet roads and sea walls during high water.
        </p>
      </section>

      <section className="mt-7">
        <h2 className="text-[22px]">Nearby</h2>
        <ul className="mt-2 space-y-1">
          <li>
            <Link className="text-link underline" href={mapHref}>
              {spot.name} on the 3D map
            </Link>
          </li>
          <li>
            <Link className="text-link underline" href={`/stations/${station.slug}`}>
              {station.name} tide station
            </Link>
          </li>
          {nearby.map(({ s, mi }) => (
            <li key={s.slug}>
              <Link className="text-link underline" href={`/spots/${s.slug}`}>
                {s.name}
              </Link>{" "}
              <span className="num text-[14px] text-muted">{milesAway(mi)}</span>
            </li>
          ))}
          <li>
            <Link className="text-link underline" href="/methodology">
              How the point query works
            </Link>
          </li>
        </ul>
      </section>
    </PageShell>
  );
}
