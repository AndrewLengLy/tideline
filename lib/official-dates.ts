import dates from "../data/king-tide-dates.json";
import { DAY, dayStart } from "./time";

export interface OfficialDateRange {
  start: string;
  end: string;
}

/** Dates the California Coastal Commission confirms, added by hand to data/king-tide-dates.json. */
export const OFFICIAL_DATES = dates.dates as OfficialDateRange[];

export function isOfficialDate(ms: number, ranges: OfficialDateRange[] = OFFICIAL_DATES): boolean {
  return ranges.some((r) => ms >= dayStart(r.start) && ms < dayStart(r.end) + DAY);
}
