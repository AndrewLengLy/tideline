// NOAA Sea Level Rise Viewer layers. Tile pixels carry the class: a palette of open water
// (9,9,145), low-lying unconnected land (85,255,0), and a depth ramp of blues. Shared by the
// browser tile pipeline and the spot point query, and free of DOM calls so both can run it.
import { hexToRgb, STEP_COLORS, STEP_EDGE } from "../colors";
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

/** Share of the NOAA depth ramp reached by a pixel: 0 at the palest blue, 1 at the darkest. */
function depthShare(r: number): number {
  return Math.max(0, Math.min(1, 1 - (r - 9) / 173));
}

const DEEP: [number, number, number] = [6, 34, 66];
const LOW: [number, number, number] = [70, 96, 111];
const EDGE = hexToRgb(STEP_EDGE);

/**
 * Repaints an RGBA tile in place for the given step. Flooded land takes the step's blue,
 * darkened by NOAA's depth. Open water goes clear so the base water tint shows. Land that is
 * low-lying and unconnected becomes a sparse dot grid. Water pixels that touch land get a
 * 1px lighter edge. Tile borders are skipped so seams never read as shoreline.
 */
export function recolorSlrTile(data: Uint8ClampedArray, width: number, height: number, ft: number): void {
  const [sr, sg, sb] = hexToRgb(STEP_COLORS[Math.max(0, Math.min(10, ft))]);
  const n = width * height;
  const cls = new Uint8Array(n); // 0 land, 1 water, 2 flooded, 3 low-lying
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const c = classifySlrPixel(data[o], data[o + 1], data[o + 2], data[o + 3]);
    cls[i] = c === "dry" ? 0 : c === "water" ? 1 : c === "flooded" ? 2 : 3;
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const o = i * 4;
      const c = cls[i];
      if (c === 0) {
        data[o + 3] = 0;
        continue;
      }
      const inner = x > 0 && y > 0 && x < width - 1 && y < height - 1;
      const onEdge =
        inner && (c === 1 || c === 2) && (cls[i - 1] === 0 || cls[i + 1] === 0 || cls[i - width] === 0 || cls[i + width] === 0 || cls[i - 1] === 3 || cls[i + 1] === 3 || cls[i - width] === 3 || cls[i + width] === 3);
      if (onEdge) {
        data[o] = EDGE[0];
        data[o + 1] = EDGE[1];
        data[o + 2] = EDGE[2];
        data[o + 3] = 255;
      } else if (c === 1) {
        data[o + 3] = 0;
      } else if (c === 2) {
        const d = depthShare(data[o]) * 0.55;
        data[o] = sr + (DEEP[0] - sr) * d;
        data[o + 1] = sg + (DEEP[1] - sg) * d;
        data[o + 2] = sb + (DEEP[2] - sb) * d;
        data[o + 3] = 255;
      } else {
        const dot = x % 5 === 0 && y % 5 === 0;
        data[o] = LOW[0];
        data[o + 1] = LOW[1];
        data[o + 2] = LOW[2];
        data[o + 3] = dot ? 255 : 46;
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
