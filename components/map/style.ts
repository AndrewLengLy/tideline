import type { ExpressionSpecification, LayerSpecification, SkySpecification, StyleSpecification } from "maplibre-gl";
import { COLOR } from "@/lib/colors";

const NAME: ExpressionSpecification = ["coalesce", ["get", "name:en"], ["get", "name"]];
const HALO = "rgba(248,250,251,0.82)";
const FONT = ["Noto Sans Regular"];
const FONT_BOLD = ["Noto Sans Bold"];
const FONT_ITALIC = ["Noto Sans Italic"];

/** Pale blue-gray sky fading to the page background at the horizon, with light distance haze. */
export const SKY: SkySpecification = {
  "sky-color": "#c9dae3",
  "horizon-color": COLOR.bg,
  "fog-color": COLOR.bg,
  "sky-horizon-blend": 0.75,
  "horizon-fog-blend": 0.65,
  "fog-ground-blend": 0.35,
  "atmosphere-blend": 0,
};

export const BEFORE_WATER_LAYERS = "water";
export const BEFORE_FLOOD_LAYERS = "road-minor";
export const BEFORE_BUILDINGS = "label-road";

const layers: LayerSpecification[] = [
  { id: "land", type: "background", paint: { "background-color": COLOR.land } },
  {
    id: "water",
    type: "fill",
    source: "ofm",
    "source-layer": "water",
    filter: ["!=", ["get", "brunnel"], "tunnel"],
    paint: { "fill-color": COLOR.bay, "fill-opacity": 0.97, "fill-antialias": false },
  },
  {
    id: "road-minor",
    type: "line",
    source: "ofm",
    "source-layer": "transportation",
    minzoom: 12.5,
    filter: ["match", ["get", "class"], ["secondary", "tertiary", "minor", "service"], true, false],
    paint: {
      "line-color": "#ffffff",
      "line-opacity": 0.42,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12.5, 0.3, 16, 2.4],
    },
  },
  {
    id: "road-major",
    type: "line",
    source: "ofm",
    "source-layer": "transportation",
    minzoom: 7,
    filter: ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#fbf8f2",
      "line-opacity": ["case", ["==", ["get", "brunnel"], "bridge"], 0.95, 0.5],
      "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.4, 11, 1.1, 16, 5],
    },
  },
  {
    id: "label-road",
    type: "symbol",
    source: "ofm",
    "source-layer": "transportation_name",
    minzoom: 14,
    filter: ["match", ["get", "class"], ["motorway", "trunk", "primary", "secondary", "tertiary"], true, false],
    layout: { "symbol-placement": "line", "text-field": NAME, "text-font": FONT, "text-size": 11 },
    paint: { "text-color": COLOR.ink, "text-opacity": 0.72, "text-halo-color": HALO, "text-halo-width": 1.2 },
  },
  {
    id: "label-water",
    type: "symbol",
    source: "ofm",
    "source-layer": "water_name",
    layout: { "text-field": NAME, "text-font": FONT_ITALIC, "text-size": 13, "text-letter-spacing": 0.04, "text-max-width": 9 },
    paint: { "text-color": "#1d5c7d", "text-opacity": 0.8, "text-halo-color": "rgba(232,244,250,0.7)", "text-halo-width": 1 },
  },
  {
    id: "label-peak",
    type: "symbol",
    source: "ofm",
    "source-layer": "mountain_peak",
    minzoom: 10,
    filter: ["has", "name"],
    layout: { "text-field": NAME, "text-font": FONT, "text-size": 11.5, "text-anchor": "bottom" },
    paint: { "text-color": COLOR.ink, "text-opacity": 0.8, "text-halo-color": HALO, "text-halo-width": 1.2 },
  },
  {
    id: "label-place",
    type: "symbol",
    source: "ofm",
    "source-layer": "place",
    filter: [
      "any",
      ["match", ["get", "class"], ["city", "town", "island"], true, false],
      ["all", ["==", ["get", "class"], "village"], [">=", ["zoom"], 10]],
      ["all", ["==", ["get", "class"], "suburb"], [">=", ["zoom"], 11.5]],
      ["all", ["==", ["get", "class"], "neighbourhood"], [">=", ["zoom"], 13]],
    ],
    layout: {
      "text-field": NAME,
      "text-font": ["match", ["get", "class"], ["city", "town"], ["literal", FONT_BOLD], ["literal", FONT]],
      "text-size": ["interpolate", ["linear"], ["zoom"], 8, ["match", ["get", "class"], ["city"], 13, 11], 13, ["match", ["get", "class"], ["city"], 18, ["town"], 15, 12.5]],
      "text-max-width": 8,
      "symbol-sort-key": ["match", ["get", "class"], ["city"], 1, ["town"], 2, 3],
    },
    paint: { "text-color": COLOR.ink, "text-opacity": 0.82, "text-halo-color": HALO, "text-halo-width": 1.3 },
  },
];

/** The first-paint style holds only the flat vector basemap. Terrain, imagery, and buildings arrive after it paints. */
export function baseStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: { ofm: { type: "vector", url: "https://tiles.openfreemap.org/planet", attribution: '<a href="https://openfreemap.org">OpenFreeMap</a> <a href="https://www.openmaptiles.org/">OpenMapTiles</a> <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' } },
    sky: SKY,
    layers,
  };
}
