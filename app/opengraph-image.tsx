import { getOverview } from "@/lib/data";
import { fmtMonthDay } from "@/lib/format";
import { OG_SIZE, OG_TYPE, ogCard } from "@/lib/og/card";
import { DEFAULT_STATION_ID } from "@/lib/site";

export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "Tideline headline: the next king tide height at Alameda, in feet above MLLW.";

export default async function Image() {
  const overview = await getOverview();
  const next = overview.stations.find((s) => s.stationId === DEFAULT_STATION_ID)?.next ?? null;
  return ogCard({
    kicker: "San Francisco Bay king tides and sea level rise",
    number: next ? next.height.toFixed(1) : "0 to 10",
    unit: "ft",
    line: next ? `Next king tide at Alameda, ${fmtMonthDay(next.t)}` : "NOAA tide predictions and sea level rise layers",
  });
}
