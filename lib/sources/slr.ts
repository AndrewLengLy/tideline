// NOAA Sea Level Rise Viewer layers. Tile pixels carry the class: a palette of open water
// (9,9,145), low-lying unconnected land (85,255,0), and a depth ramp of blues. Shared by the
// browser tile pipeline and the spot point query, and free of DOM calls so both can run it.
import { hexToRgb, STEP_COLORS, WATERLINE, WATERLINE_HALO, WET_TODAY } from "../colors";
import type { SlrStatus } from "../types";

const BASE = "https://coast.noaa.gov/arcgis/rest/services/dc_slr";

export const SLR_MAX_ZOOM = 16;
export const SLR_STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export const slrTileUrl = (ft: number, z: number | string, y: number | string, x: number | string) =>
  `${BASE}/slr_${ft}ft/MapServer/tile/${z}/${y}/${x}`;
export const confTileUrl = (ft: number, z: number | string, y: number | string, x: number | string) =>
  `${BASE}/conf_${ft}ft/MapServer/tile/${z}/${y}/${x}`;

export function classifySlrPixel(r: number, g: number, b: number, a: number): SlrStatus {
  if (a < 128) return "dry";
  if (r === 9 && g === 9 && b === 145) return "water";
  if (r === 85 && g === 255 && b === 0) return "low-lying";
  return "flooded";
}

/** Pixel classes after decoding. Wet means open water or flooded land. */
export const DRY = 0;
export const OPEN = 1;
export const FLOODED = 2;
export const LOW = 3;

export interface SlrClasses {
  w: number;
  h: number;
  /** One class per pixel: DRY, OPEN, FLOODED, or LOW. */
  cls: Uint8Array;
  /** Share of NOAA's depth ramp, 0 to 255, for flooded pixels. */
  depth: Uint8Array;
}

const isWet = (c: number) => c === OPEN || c === FLOODED;

/** Share of the NOAA depth ramp reached by a pixel: 0 at the palest blue, 1 at the darkest. */
function depthShare(r: number): number {
  return Math.max(0, Math.min(1, 1 - (r - 9) / 173));
}

/** Reads a NOAA tile into classes once, so every paint for that step and tile reuses it. */
export function decodeSlrTile(data: Uint8ClampedArray, w: number, h: number): SlrClasses {
  const n = w * h;
  const cls = new Uint8Array(n);
  const depth = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const c = classifySlrPixel(data[o], data[o + 1], data[o + 2], data[o + 3]);
    cls[i] = c === "dry" ? DRY : c === "water" ? OPEN : c === "flooded" ? FLOODED : LOW;
    if (cls[i] === FLOODED) depth[i] = Math.round(depthShare(data[o]) * 255);
  }
  return { w, h, cls, depth };
}

const DEEP: [number, number, number] = [6, 34, 66];
const LOW_RGB: [number, number, number] = [70, 96, 111];
const TODAY_RGB = hexToRgb(WET_TODAY);
const LINE_RGB = hexToRgb(WATERLINE);
const HALO_RGB = hexToRgb(WATERLINE_HALO);

function paintNewWater(out: Uint8ClampedArray, o: number, step: [number, number, number], depth: number) {
  const d = (depth / 255) * 0.5;
  out[o] = step[0] + (DEEP[0] - step[0]) * d;
  out[o + 1] = step[1] + (DEEP[1] - step[1]) * d;
  out[o + 2] = step[2] + (DEEP[2] - step[2]) * d;
  out[o + 3] = 255;
}

function paintDot(out: Uint8ClampedArray, o: number, x: number, y: number) {
  out[o] = LOW_RGB[0];
  out[o + 1] = LOW_RGB[1];
  out[o + 2] = LOW_RGB[2];
  out[o + 3] = x % 5 === 0 && y % 5 === 0 ? 255 : 46;
}

/** True when a pixel is wet and one of its four neighbors is not. Tile borders never count, so seams never read as shoreline. */
function shore(c: SlrClasses, x: number, y: number): boolean {
  const { w, h, cls } = c;
  if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) return false;
  const i = y * w + x;
  if (!isWet(cls[i])) return false;
  return !isWet(cls[i - 1]) || !isWet(cls[i + 1]) || !isWet(cls[i - w]) || !isWet(cls[i + w]);
}

/**
 * The water layer for one step, measured against today's high-tide line (the 0 ft step).
 * Land that floods only with this much added water takes the step's blue, darkened by NOAA's
 * depth. Land already wet at today's high tide (marsh and salt ponds) gets a pale tint. Open
 * water stays clear so the base water shows. Low-lying unconnected land becomes a dot grid.
 * Above 0 ft, today's high-tide line shows as a dashed line inside the new water.
 */
export function paintFill(out: Uint8ClampedArray, cur: SlrClasses, base: SlrClasses, ft: number): void {
  const step = hexToRgb(STEP_COLORS[Math.max(0, Math.min(10, ft))]);
  const { w, h } = cur;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = i * 4;
      const c = cur.cls[i];
      const b = base.cls[i];
      out[o + 3] = 0;
      if (ft > 0 && isWet(c) && shore(base, x, y) && (x + y) % 6 < 3) {
        out[o] = LINE_RGB[0];
        out[o + 1] = LINE_RGB[1];
        out[o + 2] = LINE_RGB[2];
        out[o + 3] = 210;
      } else if (c === FLOODED && !isWet(b)) {
        paintNewWater(out, o, step, cur.depth[i]);
      } else if (c === FLOODED) {
        out[o] = TODAY_RGB[0];
        out[o + 1] = TODAY_RGB[1];
        out[o + 2] = TODAY_RGB[2];
        out[o + 3] = 110;
      } else if (c === LOW && !isWet(b)) {
        paintDot(out, o, x, y);
      }
    }
  }
}

/**
 * Only the land that goes under between one step and the next, painted in the upper step's blue.
 * The map fades this band in as the water level moves between whole feet. The shoreline then
 * creeps across the band.
 */
export function paintBand(out: Uint8ClampedArray, upper: SlrClasses, lower: SlrClasses, upperFt: number): void {
  const step = hexToRgb(STEP_COLORS[Math.max(0, Math.min(10, upperFt))]);
  const { w, h } = upper;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = i * 4;
      const u = upper.cls[i];
      const l = lower.cls[i];
      out[o + 3] = 0;
      if (isWet(u) && !isWet(l)) paintNewWater(out, o, step, upper.depth[i]);
      else if (u === LOW && l !== LOW && !isWet(l)) paintDot(out, o, x, y);
    }
  }
}

/**
 * The waterline: a two-pixel bright line on the wet side of every shore, with a one-pixel dark
 * halo on the dry side so it reads over both marsh and pavement in the aerial imagery.
 */
export function paintEdge(out: Uint8ClampedArray, cur: SlrClasses): void {
  const { w, h, cls } = cur;
  const ring = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (shore(cur, x, y)) ring[y * w + x] = 1;
  out.fill(0);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const o = i * 4;
      const c = cls[i];
      const nearRing = ring[i - 1] || ring[i + 1] || ring[i - w] || ring[i + w];
      if (ring[i] || (isWet(c) && nearRing)) {
        out[o] = LINE_RGB[0];
        out[o + 1] = LINE_RGB[1];
        out[o + 2] = LINE_RGB[2];
        out[o + 3] = 255;
      } else if (!isWet(c) && nearRing) {
        out[o] = HALO_RGB[0];
        out[o + 1] = HALO_RGB[1];
        out[o + 2] = HALO_RGB[2];
        out[o + 3] = 150;
      }
    }
  }
}

/** Confidence tiles use orange (255,170,0) for low confidence. That class becomes a diagonal hatch and the rest goes clear. */
export function recolorConfTile(data: Uint8ClampedArray, width: number, height: number): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const low = data[o + 3] > 128 && data[o] === 255 && data[o + 1] === 170 && data[o + 2] === 0;
      const stripe = (x + y) % 7 < 2;
      data[o] = 13;
      data[o + 1] = 34;
      data[o + 2] = 48;
      data[o + 3] = low && stripe ? 170 : 0;
    }
  }
}
