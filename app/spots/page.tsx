import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { fmtDate } from "@/lib/format";
import { SPOTS, SPOTS_CHECKED_AT } from "@/lib/spots";
import { stationById } from "@/lib/stations";

const description = `${SPOTS.length} San Francisco Bay places where king tide flooding is commonly photographed, with the sea level rise step that first floods each one.`;

export const metadata: Metadata = {
  title: "San Francisco Bay king tide photo spots",
  description,
  alternates: { canonical: "/spots" },
  openGraph: { url: "/spots", title: "San Francisco Bay king tide photo spots", description },
  twitter: { title: "San Francisco Bay king tide photo spots", description },
};

export default function SpotsPage() {
  const sorted = [...SPOTS].sort((a, b) => (a.firstFloodFt ?? 99) - (b.firstFloodFt ?? 99) || a.name.localeCompare(b.name));
  return (
    <PageShell>
      <h1 className="text-[30px]">San Francisco Bay king tide photo spots</h1>
      <p className="mt-3 max-w-2xl">
        Places where king tide flooding is commonly photographed or where groups gather to watch it. The middle column is the lowest NOAA sea level rise layer that reaches the spot, measured by a point query at each foot from 0 to 10.
      </p>
      <div className="mt-5 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Spot</th>
              <th scope="col">First floods at</th>
              <th scope="col">Nearest gauge</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.slug}>
                <td>
                  <Link className="text-link underline" href={`/spots/${s.slug}`}>
                    {s.name}
                  </Link>
                </td>
                <td className="num whitespace-nowrap">{s.firstFloodFt === null ? "above 10 ft" : `${s.firstFloodFt} ft`}</td>
                <td className="whitespace-nowrap">
                  <Link className="text-link underline" href={`/stations/${stationById(s.nearestStationId)?.slug}`}>
                    {stationById(s.nearestStationId)?.name}
                  </Link>{" "}
                  <span className="num text-[14px] text-muted">{s.nearestStationMi} mi</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {SPOTS_CHECKED_AT ? <p className="mt-2 text-[14px] text-muted">Point query against NOAA SLR Viewer tiles, as of {fmtDate(SPOTS_CHECKED_AT)}. Screening-level, verify on site.</p> : null}
      <p className="mt-5">
        Find the dates on the{" "}
        <Link className="text-link underline" href="/king-tides">
          king tide calendar
        </Link>
        , see the water on the{" "}
        <Link className="text-link underline" href="/">
          3D map
        </Link>
        , or read{" "}
        <Link className="text-link underline" href="/methodology">
          how the point query works
        </Link>
        .
      </p>
    </PageShell>
  );
}
