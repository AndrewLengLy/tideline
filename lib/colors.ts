// Palette from the brief, plus the sea level rise steps. Foot values are always printed
// next to a step color, so the scale never carries meaning by color alone.
export const COLOR = {
  bg: "#eef3f5",
  panel: "#f7fafb",
  ink: "#0d2230",
  muted: "#46606f",
  water: "#0077b6",
  coral: "#e76f51",
  line: "#cfdbe1",
  land: "#e8e4dc",
  bay: "#c4dfec",
  building: "#e6e1d8",
} as const;

/** Index is the sea level rise step in feet. Lightness falls at every step. */
export const STEP_COLORS = [
  "#9ad4ef",
  "#7ec7ea",
  "#62b9e3",
  "#46aadb",
  "#2b9bd1",
  "#148ac5",
  "#0077b6",
  "#06669f",
  "#0a5587",
  "#0c4570",
  "#0c3659",
] as const;

export const STEP_EDGE = "#e8f7ff";

export function hexToRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

export function stepColor(ft: number): string {
  return STEP_COLORS[Math.max(0, Math.min(10, Math.round(ft)))];
}
