import { getOverview } from "@/lib/data";
import { fmtMonthDay } from "@/lib/format";
import { OG_SIZE, OG_TYPE, ogCard } from "@/lib/og/card";
import { stationBySlug, STATIONS } from "@/lib/stations";

export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "Tide station headline: the next king tide height in feet above MLLW.";

export function generateStaticParams() {
  return STATIONS.map((s) => ({ slug: s.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const station = stationBySlug(slug);
  const overview = await getOverview();
  const o = overview.stations.find((s) => s.stationId === station?.id);
  return ogCard({
    kicker: `${station?.name ?? "Bay"} tide station`,
    number: o?.next ? o.next.height.toFixed(1) : "NOAA",
    unit: o?.next ? "ft" : "gauge",
    line: o?.next ? `Next king tide, ${fmtMonthDay(o.next.t)}` : "Predictions and flood thresholds",
  });
}
