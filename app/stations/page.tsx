import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { getOverview } from "@/lib/data";
import { fmtAsOf, fmtShortDay, ft } from "@/lib/format";
import { STATIONS } from "@/lib/stations";

export const revalidate = 3600;

const description = `${STATIONS.length} NOAA tide gauges around San Francisco Bay, with the next king tide, flood thresholds, and days over threshold at each.`;

export const metadata: Metadata = {
  title: "San Francisco Bay tide stations",
  description,
  alternates: { canonical: "/stations" },
  openGraph: { url: "/stations", title: "San Francisco Bay tide stations", description },
  twitter: { title: "San Francisco Bay tide stations", description },
};

export default async function StationsPage() {
  const overview = await getOverview();
  return (
    <PageShell>
      <h1 className="text-[30px]">San Francisco Bay tide stations</h1>
      <p className="mt-3 max-w-2xl">
        Every active NOAA water level gauge in the Bay with tide predictions, plus Point Reyes on the outer coast. The last column counts predicted days over the flood threshold in the next 12 months with 3 ft of sea level rise added.
      </p>
      <div className="mt-5 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Station</th>
              <th scope="col">Next king tide</th>
              <th scope="col">Height</th>
              <th scope="col">Minor threshold</th>
              <th scope="col">Days at +3 ft</th>
            </tr>
          </thead>
          <tbody>
            {STATIONS.map((s) => {
              const o = overview.stations.find((x) => x.stationId === s.id);
              return (
                <tr key={s.id}>
                  <td className="whitespace-nowrap">
                    <Link className="text-link underline" href={`/stations/${s.slug}`}>
                      {s.name}
                    </Link>
                  </td>
                  <td className="num whitespace-nowrap">{o?.next ? fmtShortDay(o.next.t) : "no data"}</td>
                  <td className="num">{o?.next ? ft(o.next.height) : ""}</td>
                  <td className="num whitespace-nowrap">{s.thresholds.minor !== null ? `${ft(s.thresholds.minor, 2)} above MHHW` : "none published"}</td>
                  <td className="num whitespace-nowrap">
                    {o?.daysOver.at(-1)?.days ?? ""}
                    {o?.thresholdKind === "action" ? " (action level)" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[14px] text-muted">Heights in feet above MLLW. Predictions from NOAA CO-OPS, {fmtAsOf(overview.asOf)}.</p>
      <p className="mt-5">
        See the gauges rise and fall on the{" "}
        <Link className="text-link underline" href="/">
          3D map
        </Link>
        , or read{" "}
        <Link className="text-link underline" href="/methodology">
          how each number is calculated
        </Link>
        .
      </p>
    </PageShell>
  );
}
