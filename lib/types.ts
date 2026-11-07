/** A predicted high or low tide. Height in feet above MLLW, time in UTC ms. */
export interface HiLo {
  t: number;
  v: number;
  type: "H" | "L";
}

export interface SeriesPoint {
  t: number;
  v: number;
}

/** Datum heights in feet above MLLW, from the CO-OPS metadata API. */
export interface StationDatums {
  epoch: string;
  mhhw: number;
  mhw: number | null;
  msl: number;
  mlw: number | null;
  mllw: number;
  navd88: number | null;
}

/** Flood levels in feet above MHHW. All null when NOAA publishes none for a gauge. */
export interface StationThresholds {
  minor: number | null;
  moderate: number | null;
  major: number | null;
  nwsMinor: number | null;
  action: number | null;
}

export interface FloodDayCount {
  metYear: number;
  minor: number;
  moderate: number;
  major: number;
  completeness: number;
}

export interface Station {
  id: string;
  slug: string;
  name: string;
  noaaName: string;
  lat: number;
  lng: number;
  /** Compass bearing from the gauge toward open water, used when the camera flies there. */
  facing: number;
  datums: StationDatums;
  thresholds: StationThresholds;
  floodDays: FloodDayCount[];
}

export interface KingTide {
  stationId: string;
  stationName: string;
  stationSlug: string;
  t: number;
  /** Feet above MLLW. */
  height: number;
  /** Feet above MHHW, which equals the future-tide equivalent when positive. */
  aboveMhhw: number;
}

export interface DaysOverRow {
  addFt: number;
  days: number;
}

export interface SurgeSummary {
  /** Largest observed minus predicted value in the window, in feet. */
  maxFt: number;
  at: number;
  latestFt: number;
  latestAt: number;
  count: number;
}

export type SlrStatus = "dry" | "low-lying" | "flooded" | "water";

export interface Spot {
  slug: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  facing: number;
  fact: string;
  sourceName: string;
  sourceUrl: string;
  /** True when the cited source reports water reaching this place at king tides. Otherwise it reports an event or a photo. */
  floodingReported: boolean;
  nearestStationId: string;
  nearestStationMi: number;
  /** Lowest NOAA step where the point is connected and flooded. Null if it stays dry through 10 ft. */
  firstFloodFt: number | null;
  /** Lowest NOAA step where the point is low-lying but not connected. Null if never. */
  firstLowLyingFt: number | null;
  steps: SlrStatus[];
}

/** A named place for the water slider, with the NOAA step that first floods it. */
export interface Place {
  name: string;
  lat: number;
  lng: number;
  firstFloodFt: number | null;
  spotSlug?: string;
}

/** The slim shapes the map page sends to the browser. Detail pages carry the rest. */
export type MapStation = Omit<Station, "floodDays" | "noaaName">;
export type MapSpot = Pick<Spot, "slug" | "name" | "lat" | "lng" | "facing" | "nearestStationId">;
export type MapPlace = Pick<Place, "name" | "firstFloodFt">;
export interface MapStationOverview {
  stationId: string;
  next: KingTide | null;
  /** The station's king tides as [time, height]. */
  kings: [number, number][];
  daysOver: DaysOverRow[];
  thresholdKind: "minor" | "action" | null;
}
export interface MapOverview {
  asOf: number;
  stations: MapStationOverview[];
}

export interface StationOverview {
  stationId: string;
  kingTides: KingTide[];
  next: KingTide | null;
  daysOver: DaysOverRow[];
  /** "minor" when the counts use NOAA's minor threshold, "action" for the gauge's action level, null when neither exists. */
  thresholdKind: "minor" | "action" | null;
  thresholdFt: number | null;
  highCount: number;
}

export interface Overview {
  asOf: number;
  stations: StationOverview[];
  calendar: KingTide[];
  failed: string[];
}
