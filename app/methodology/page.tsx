import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { getOverview } from "@/lib/data";
import { fmtAsOf, fmtMonthDay, ft } from "@/lib/format";
import { jsonLdHtml } from "@/lib/jsonld";
import { DEFAULT_STATION_ID, LINKS, REPO_URL, SAFETY_LINE } from "@/lib/site";
import { addDays, pacificDay } from "@/lib/time";

export const revalidate = 3600;

const description = "How Tideline turns NOAA tide predictions and sea level rise layers into king tide dates and flood counts: sources, formulas, limits, and changelog.";

export const metadata: Metadata = {
  title: "How Tideline works",
  description,
  alternates: { canonical: "/methodology" },
  openGraph: { url: "/methodology", title: "How Tideline works", description },
  twitter: { title: "How Tideline works", description },
};

const FAQ: [string, string][] = [
  ["What is a king tide?", "A king tide is an informal name for the highest predicted tides of the year. They happen when the Moon sits closest to Earth and lines up with the Sun. In San Francisco Bay they arrive around the winter and summer solstices."],
  ["Does a king tide mean flooding?", "Sometimes. A king tide on a calm day may only wet low paths and parking lots. The same tide with a storm on top can flood roads. Tide predictions leave out weather, so the residual chart shows how far real water is running from the prediction."],
  ["Why do thresholds differ from the slider?", "The slider moves NOAA's mapped water extent. Flood thresholds are water levels at one gauge. They answer different questions, and the map shows both so they can be compared."],
  ["Why do some gauges have no flood threshold?", "NOAA publishes minor, moderate, and major levels for San Francisco, Alameda, Point Reyes, and Port Chicago. Redwood City, Richmond, and Martinez have an action level only. Tideline says so on those pages and counts days over the action level, labeled as such."],
];

function datasets(today: string) {
  const year = `${today}/${addDays(today, 365)}`;
  const org = (name: string, url: string) => ({ "@type": "Organization", name, url });
  const noaa = org("NOAA Center for Operational Oceanographic Products and Services", LINKS.coops);
  const ocm = org("NOAA Office for Coastal Management", "https://coast.noaa.gov");
  return [
    { "@type": "Dataset", name: "NOAA CO-OPS tide predictions", description: "High, low, and 6-minute predicted water levels for San Francisco Bay gauges.", url: LINKS.coopsDocs, creator: noaa, temporalCoverage: year },
    { "@type": "Dataset", name: "NOAA CO-OPS observed water levels", description: "6-minute observed water levels over the last 72 hours at San Francisco Bay gauges.", url: LINKS.coopsDocs, creator: noaa, temporalCoverage: `${addDays(today, -3)}/${today}` },
    { "@type": "Dataset", name: "NOAA CO-OPS datums and flood levels", description: "Tidal datums and flood levels for each gauge, from the metadata API.", url: LINKS.coopsMeta, creator: noaa, temporalCoverage: "1983/2001" },
    { "@type": "Dataset", name: "NOAA CO-OPS high tide flood counts", description: "Observed high tide flood days per meteorological year, from the derived product API.", url: LINKS.coopsDerived, creator: noaa },
    { "@type": "Dataset", name: "NOAA Sea Level Rise Viewer layers", description: "Modeled inundation and mapping confidence at 0 to 10 ft above mean higher high water.", url: LINKS.slrViewer, creator: ocm },
    { "@type": "Dataset", name: "USGS National Map imagery", description: "Orthoimagery used as the base layer.", url: LINKS.usgsImagery, creator: org("U.S. Geological Survey", "https://www.usgs.gov"), license: "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits" },
    { "@type": "Dataset", name: "AWS Terrain Tiles", description: "Global elevation tiles in Terrarium encoding, used for 3D terrain and hillshade.", url: LINKS.awsTerrain, creator: org("Mapzen", "https://www.mapzen.com") },
    { "@type": "Dataset", name: "California King Tides Project", description: "Official statewide king tide dates and community photos.", url: LINKS.kingTides, creator: org("California Coastal Commission", "https://www.coastal.ca.gov") },
  ].map((d) => ({ "@context": "https://schema.org", ...d, isAccessibleForFree: true }));
}

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
};

export default async function MethodologyPage() {
  const overview = await getOverview();
  const today = pacificDay(overview.asOf);
  const alameda = overview.stations.find((s) => s.stationId === DEFAULT_STATION_ID);
  const next = alameda?.next ?? null;
  const rows = alameda?.daysOver ?? [];

  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(datasets(today))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(faqLd)} />
      <article className="prose-field max-w-2xl">
        <h1 className="text-[30px]">How Tideline works</h1>
        <p>
          A field note on a small analysis tool, built by <a href="https://andrewlengly.com">Andrew Leng Ly</a> as part of a series on hazard data. Every source it uses works with no key.
        </p>

        <h2>The question</h2>
        <p>
          How much sea level rise turns today&apos;s highest tide of the year into an ordinary high tide, and where does that water go? A king tide is a preview of a future everyday high. Tideline puts a number on that gap at each gauge and draws the matching water on the shoreline.
        </p>
        {next && rows.length ? (
          <p>
            At Alameda the next king tide is {ft(next.height)} on {fmtMonthDay(next.t)}, or {ft(next.aboveMhhw)} above mean higher high water (MHHW). Predicted days over the gauge&apos;s minor flood threshold in the next 12 months go from {rows[0].days} today to {rows[1].days} with 1 ft of rise, {rows[2].days} with 2 ft, and {rows[3].days} with 3 ft. Predictions {fmtAsOf(overview.asOf)}.
          </p>
        ) : null}

        <h2>Data sources</h2>
        <h3>NOAA CO-OPS tide predictions and water levels</h3>
        <p>
          The <a href={LINKS.coopsDocs}>CO-OPS data API</a> supplies high and low predictions, 6-minute predicted curves, and observed water levels, all in feet above mean lower low water (MLLW) on local time. Predictions refresh once a day through a cron job, and observed levels refresh every 6 minutes. NOAA limits high and low requests to 1 year and 6-minute requests to 1 month, so longer ranges are split. Observed values are preliminary and can change after NOAA reviews them. Predictions cover astronomy alone, so they leave out weather and river flow.
        </p>
        <h3>NOAA CO-OPS datums and flood levels</h3>
        <p>
          Datums come from the <a href={LINKS.coopsMeta}>metadata API</a>, on the 1983 to 2001 tidal epoch. Flood levels come from the same API, which publishes them above the station datum. Tideline restates them above MHHW. The <a href={LINKS.coopsDerived}>derived product API</a> supplies counts of observed flood days and holds no thresholds. Four of the seven gauges have minor, moderate, and major levels. Datums and flood levels are built by script and committed, since they change rarely.
        </p>
        <h3>NOAA Sea Level Rise Viewer layers</h3>
        <p>
          Water extents come from the tiled <a href={LINKS.slrServices}>dc_slr map services</a> behind the <a href={LINKS.slrViewer}>Sea Level Rise Viewer</a>, one layer per foot from 0 to 10 above MHHW, where 0 is current MHHW. These are screening-level layers built with a modified bathtub method that accounts for tidal variation and hydrologic connectivity. NOAA describes them as showing the scale of potential flooding, and says to verify any feature with a site visit. They leave out erosion and future construction. Each layer has a matching confidence layer, drawn here as a hatch where the cell could be wet or dry. Tiles are cached to level 16, or about 2.4 m per pixel.
        </p>
        <p>
          Tideline repaints NOAA&apos;s tiles in the browser. Flooded land takes a blue that darkens with each foot, and NOAA&apos;s depth ramp darkens it further. Open water goes clear so the base water tint shows. Land below the water level with no connection to the Bay, which NOAA calls low-lying, becomes a dot grid.
        </p>
        <h3>California King Tides Project</h3>
        <p>
          The <a href={LINKS.kingTides}>California Coastal Commission</a> confirms official statewide dates each fall. Those dates are stored by hand and shown as a separate label. Tideline computes its own highest tides from predictions and never treats the two as the same thing. Photos go to the Project through its <a href={LINKS.kingTidesUpload}>upload form</a>.
        </p>
        <h3>Map layers</h3>
        <p>
          Aerial imagery comes from the <a href={LINKS.usgsImagery}>USGS National Map</a>, which is public domain. It shows banding over open water, so a flat water tint from <a href={LINKS.openFreeMap}>OpenFreeMap</a> covers the Bay. Terrain comes from <a href={LINKS.awsTerrain}>AWS Terrain Tiles (Mapzen)</a> in Terrarium encoding. That dataset includes Bay bathymetry, and Tideline sets everything below sea level to zero so the Bay stays one flat surface at 3x exaggeration. Roads, labels, and building footprints come from OpenFreeMap with <a href={LINKS.osm}>OpenStreetMap</a> data.
        </p>

        <h2>How each number is calculated</h2>
        <h3>Height above MHHW</h3>
        <p>
          <code>above = predicted height (ft above MLLW) - MHHW (ft above MLLW)</code>
        </p>
        <h3>King tide list</h3>
        <p>The 20 predicted high tides in the next 12 months with the largest height above MHHW, per station. The Bay calendar takes the 20 largest across Bay gauges and leaves out Point Reyes, which sits on the open coast. Next king tide means the earliest upcoming tide on a station&apos;s list.</p>
        <h3>Future-tide equivalent</h3>
        <p>
          <code>equivalent = max(0, above)</code>
        </p>
        <p>This is the sea level rise, in feet, at which a water level becomes an ordinary daily high. It assumes the tide range stays the same as sea level rises.</p>
        <h3>Days over threshold</h3>
        <p>
          <code>days(add) = count of Pacific calendar days with a high where height + add - MHHW &gt; threshold</code>
        </p>
        <p>Counted for add values of 0, 1, 2, and 3 ft across the next 12 months of predicted highs. The threshold is NOAA&apos;s minor level above MHHW. At gauges with no minor level, the count uses the action level and says so.</p>
        <h3>Surge</h3>
        <p>
          <code>residual = observed - predicted</code>
        </p>
        <p>Matched on 6-minute time stamps over the last 72 hours. Surge is the largest residual in that window, with its time. Predictions use a 1983 to 2001 reference, so part of every residual is sea level rise that has already happened. When residuals near 1 ft last for days across every gauge, the cause is larger than wind at one site.</p>
        <h3>First flood step at a shoreline spot</h3>
        <p>
          NOAA&apos;s identify service answered with the same polygon at every point during testing, so Tideline reads the map tiles directly. Each spot&apos;s point sits on the feature people go to see. Where a place spans a range of heights, such as a park on old fill, the point goes on its lowest public road or path, chosen by sampling OpenStreetMap paths.
        </p>
        <ol>
          <li>Take a 5 by 5 grid of points within about 15 m of the spot.</li>
          <li>Read each point&apos;s pixel in the level 16 tile for the 0 ft layer, and drop points that are open water.</li>
          <li>Read the remaining points in the tile for each foot from 0 to 10.</li>
          <li>Record the lowest foot where at least a quarter of them are wet and connected.</li>
        </ol>
        <p>Wide places on the slider, such as airports, use a larger grid and need half of their land wet. Several spots have reports of water at king tides well below their step on NOAA&apos;s layer, and their pages say so. The Embarcadero is one example. That gap is a limit of the layer.</p>
        <h3>Water on the map</h3>
        <p>
          <code>layer = round(slider + max(0, tide above MHHW at the selected gauge))</code>
        </p>
        <p>The scrubber can add its tide to the slider, which is on by default. Water above MHHW raises the layer to the nearest foot. A checkbox in the Layers tab turns this off. Gauge columns show water level above MHHW at the scrubber time plus the slider. Observed readings replace predictions wherever both exist. Column heights are drawn for legibility and exaggerated with the terrain setting, and each label prints the true value.</p>

        <h2>What this tool cannot tell you</h2>
        <p>
          It cannot tell you whether a given street will flood on a given day. Predictions leave out weather. The sea level rise layers leave out storms and waves. They also miss storm drains and recent levees. A point query reports what a screening map shows at a pixel, so a flooded step on a spot page is a reason to go look. A site survey is the real test.
        </p>
        <p>
          Spot tide times come from the nearest active gauge, which can be miles away, and the local peak can differ. The future-tide equivalent assumes tides keep today&apos;s shape, and real tidal range can shift as the Bay deepens. Sea level rise on this site is a set of what-if steps with no dates attached. Tideline makes no forecast of when any step arrives.
        </p>

        <h2>Questions</h2>
        {FAQ.map(([q, a]) => (
          <div key={q}>
            <h3>{q}</h3>
            <p>{a}</p>
          </div>
        ))}

        <h2>Safety</h2>
        <p>
          {SAFETY_LINE} For the Bay Area, that means <a href={LINKS.nws}>NWS Bay Area coastal flood advisories</a> and <a href={LINKS.coops}>NOAA Tides and Currents</a>.
        </p>

        <h2>Changelog</h2>
        <ol>
          <li>November 6, 2026. First release, with {overview.stations.length || 7} stations and 15 shoreline spots.</li>
        </ol>

        <p className="mt-8">
          Back to the <Link href="/">3D map</Link> or the <Link href="/king-tides">king tide calendar</Link>. The code is in the <a href={REPO_URL}>GitHub repo</a>.
        </p>
      </article>
    </PageShell>
  );
}
