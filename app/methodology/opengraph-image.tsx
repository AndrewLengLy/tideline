import { OG_SIZE, OG_TYPE, ogCard } from "@/lib/og/card";
import { getOverview } from "@/lib/data";
import { DEFAULT_STATION_ID } from "@/lib/site";

export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "Methodology headline: predicted days over the flood threshold at Alameda with 3 ft of sea level rise.";

export default async function Image() {
  const overview = await getOverview();
  const rows = overview.stations.find((s) => s.stationId === DEFAULT_STATION_ID)?.daysOver ?? [];
  const last = rows.at(-1);
  return ogCard({
    kicker: "How Tideline works",
    number: last ? String(last.days) : "0 to 10",
    unit: last ? "days" : "ft",
    line: last ? `Over the flood threshold at Alameda with 3 ft of rise, up from ${rows[0].days}` : "Sources, formulas, and limits",
  });
}
