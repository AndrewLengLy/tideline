// What NOAA's layers say about one point, and roughly when the state expects that much rise.

/** Pixel class at a point for one step: dry, open water, flooded land, or low-lying unconnected land. */
export type PointClass = "dry" | "open" | "flooded" | "low" | "unknown";

export interface PlaceReport {
  /** Open water or already-wet marsh at today's high tide. */
  today: "open" | "wet" | null;
  /** First whole foot of rise at which the point is connected water, or null through 10 ft. */
  firstWetFt: number | null;
  /** First foot at which the point sits below the water level but cut off from the Bay, before it floods outright. */
  firstLowFt: number | null;
  /** True when a tile failed to load for some step, so the answer may be incomplete. */
  partial: boolean;
}

/** Reads eleven per-foot classes (0 to 10 ft) into a plain answer. */
export function reportFor(classes: PointClass[]): PlaceReport {
  const partial = classes.some((c) => c === "unknown");
  const c0 = classes[0];
  if (c0 === "open" || c0 === "flooded") return { today: c0 === "open" ? "open" : "wet", firstWetFt: 0, firstLowFt: null, partial };
  let firstWetFt: number | null = null;
  let firstLowFt: number | null = null;
  for (let ft = 1; ft < classes.length; ft++) {
    const c = classes[ft];
    if (c === "open" || c === "flooded") {
      firstWetFt = ft;
      break;
    }
    if (c === "low" && firstLowFt === null) firstLowFt = ft;
  }
  return { today: null, firstWetFt, firstLowFt, partial };
}

/**
 * When the state expects a given rise, from the Ocean Protection Council's 2024 statewide figures
 * against a 2000 baseline: 0.8 ft by 2050 and 3.1 ft by 2100 in the intermediate scenario, and
 * 6.6 ft by 2100 in the high scenario. Years between 2050 and 2100 are a straight line between
 * those two points, rounded to five years, so they read as rough.
 */
export function whenRise(ft: number): string {
  if (ft <= 0) return "Today, at an ordinary high tide";
  if (ft <= 0.8) return "By about 2050 in the state's intermediate scenario";
  if (ft <= 3.1) {
    const year = 2050 + ((ft - 0.8) / (3.1 - 0.8)) * 50;
    return `Around ${Math.round(year / 5) * 5} in the state's intermediate scenario`;
  }
  if (ft <= 6.6) return "By 2100 only in the state's high scenario";
  return "After 2100, even in the state's high scenario";
}
