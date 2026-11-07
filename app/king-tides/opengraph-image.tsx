import { getOverview } from "@/lib/data";
import { fmtMonthDay } from "@/lib/format";
import { OG_SIZE, OG_TYPE, ogCard } from "@/lib/og/card";

export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "King tide calendar headline: the highest predicted tide in San Francisco Bay, in feet above MLLW.";

export default async function Image() {
  const { calendar } = await getOverview();
  const top = [...calendar].sort((a, b) => b.aboveMhhw - a.aboveMhhw)[0] ?? null;
  return ogCard({
    kicker: "King tide calendar for San Francisco Bay",
    number: top ? top.height.toFixed(1) : "20",
    unit: top ? "ft" : "tides",
    line: top ? `${top.stationName}, ${fmtMonthDay(top.t)}, highest of the next 12 months` : "The highest predicted tides of the year",
  });
}
