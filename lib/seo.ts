import { fmtMonthDay, ft } from "./format";
import type { Spot, Station, StationOverview } from "./types";

export const MAX_TITLE = 60;
export const MAX_DESCRIPTION = 155;
/** The layout template adds this to every page title. */
export const TITLE_SUFFIX = " | Tideline";

export interface PageMeta {
  title: string;
  description: string;
}

export function stationMeta(station: Station, o: StationOverview | null | undefined): PageMeta {
  const rows = o?.daysOver ?? [];
  const parts = [o?.next ? `Next king tide at ${station.name}: ${ft(o.next.height)} on ${fmtMonthDay(o.next.t)}.` : `Tide data for the ${station.name} gauge.`];
  if (rows.length) parts.push(`${rows[0].days} days over threshold in 12 months, ${rows[rows.length - 1].days} with 3 ft of sea level rise.`);
  return { title: `${station.name} king tides and flood thresholds`, description: parts.join(" ") };
}

export function spotMeta(spot: Spot, nearest: StationOverview | null | undefined, stationName: string): PageMeta {
  const flood = spot.firstFloodFt === null ? "Stays dry through 10 ft of sea level rise on NOAA's layer." : `First floods at ${spot.firstFloodFt} ft of sea level rise on NOAA's layer.`;
  const next = nearest?.next ? ` Next king tide ${ft(nearest.next.height)} on ${fmtMonthDay(nearest.next.t)} at ${stationName}.` : "";
  return { title: `${spot.name} king tides`, description: `${spot.name}. ${flood}${next}` };
}
