import type { Metadata } from "next";
import Link from "next/link";
import { CalendarTable } from "@/components/CalendarTable";
import { PageShell, Stat } from "@/components/PageShell";
import { getOverview } from "@/lib/data";
import { fmtAsOf, fmtMonthDay, fmtShortDay, fmtTime, ft } from "@/lib/format";
import { futureTideEquivalent } from "@/lib/metrics/king-tides";
import { LINKS } from "@/lib/site";
import { OFFICIAL_DATES } from "@/lib/official-dates";
import { STATIONS } from "@/lib/stations";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const { calendar } = await getOverview();
  const top = [...calendar].sort((a, b) => b.aboveMhhw - a.aboveMhhw)[0];
  const description = top
    ? `The 20 highest predicted tides in San Francisco Bay. The peak is ${ft(top.height)} at ${top.stationName} on ${fmtMonthDay(top.t)}. Export any tide as a calendar event.`
    : "The 20 highest predicted tides in San Francisco Bay in the next 12 months, with calendar export.";
  return {
    title: "King tide calendar for San Francisco Bay",
    description,
    alternates: { canonical: "/king-tides" },
    openGraph: { url: "/king-tides", title: "King tide calendar for San Francisco Bay", description },
    twitter: { title: "King tide calendar for San Francisco Bay", description },
  };
}

export default async function KingTidesPage() {
  const overview = await getOverview();
  const { calendar } = overview;
  const top = [...calendar].sort((a, b) => b.aboveMhhw - a.aboveMhhw)[0] ?? null;
  const next = calendar[0] ?? null;
  const perStation = Object.fromEntries(overview.stations.map((s) => [s.stationId, s.kingTides]));
  return (
    <PageShell>
      <h1 className="text-[30px]">King tide calendar for San Francisco Bay</h1>
      <p className="mt-3 max-w-2xl">
        The 20 highest predicted tides at Bay gauges over the next 12 months, ranked by height above mean higher high water (MHHW) and listed by date. The future-tide equivalent is the sea level rise at which that water level becomes an ordinary daily high. Each row exports a calendar event timed 30 minutes before the peak.
      </p>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {top ? (
          <Stat label={`Highest tide, ${top.stationName}`} value={ft(top.height)} note={`${fmtShortDay(top.t)}, ${fmtTime(top.t)}. ${ft(futureTideEquivalent(top.aboveMhhw))} above MHHW.`} testId="headline-number" />
        ) : null}
        {next ? <Stat label={`Next on this list, ${next.stationName}`} value={ft(next.height)} note={`${fmtShortDay(next.t)}, ${fmtTime(next.t)}. ${ft(futureTideEquivalent(next.aboveMhhw))} above MHHW.`} /> : null}
      </dl>
      <p className="mt-2 text-[14px] text-muted">Heights in feet above MLLW. Predictions from NOAA CO-OPS, {fmtAsOf(overview.asOf)}.</p>
      {overview.failed.length ? <p className="mt-2 text-[15px] text-coral-ink">NOAA did not answer for {overview.failed.length} station(s). They return on the next refresh.</p> : null}

      <section className="mt-7">
        <h2 className="text-[22px]">The list</h2>
        <div className="mt-3">
          <CalendarTable calendar={calendar} perStation={perStation} stations={STATIONS} />
        </div>
        <p className="mt-3 text-[14px] text-muted">The all-stations view leaves out Point Reyes because it sits on the open coast and runs higher than any gauge inside the Bay. Pick it above to see its tides.</p>
      </section>

      <section className="mt-8 max-w-2xl">
        <h2 className="text-[22px]">Official dates</h2>
        {OFFICIAL_DATES.length ? (
          <p className="mt-2">Rows tagged Coastal Commission date fall on the statewide dates confirmed by the California King Tides Project.</p>
        ) : (
          <p className="mt-2">This list comes from NOAA predictions alone. The California Coastal Commission confirms its own statewide dates each fall, and rows here get a tag once those dates are added.</p>
        )}
        <p className="mt-2">
          See the{" "}
          <a className="text-link underline" href={LINKS.kingTides}>
            California King Tides Project
          </a>{" "}
          for current dates, and send photos through its{" "}
          <a className="text-link underline" href={LINKS.kingTidesUpload}>
            upload form
          </a>
          .
        </p>
        <p className="mt-3">
          Open the{" "}
          <Link className="text-link underline" href="/">
            3D map
          </Link>{" "}
          to see where this water lands, browse{" "}
          <Link className="text-link underline" href="/spots">
            shoreline spots
          </Link>
          , or read{" "}
          <Link className="text-link underline" href="/methodology">
            how the list is calculated
          </Link>
          .
        </p>
      </section>
    </PageShell>
  );
}
