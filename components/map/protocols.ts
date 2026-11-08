// Custom tile protocols. Each one fetches a public tile, repaints it on a canvas, and hands
// MapLibre the result as a bitmap. This is how NOAA's palette becomes Tideline's blue steps.
import maplibregl from "maplibre-gl";
import { confTileUrl, paintBand, paintEdge, paintFill, recolorConfTile } from "@/lib/sources/slr";
import { classes } from "./slr-cache";

const TERRAIN = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";
const SIZE = 256;

let registered = false;
let blank: ImageBitmap | null = null;

async function blankTile(): Promise<ImageBitmap> {
  if (!blank) blank = await createImageBitmap(new ImageData(1, 1));
  return blank;
}

async function repaint(url: string, signal: AbortSignal, edit: (d: Uint8ClampedArray, w: number, h: number) => void): Promise<{ data: ImageBitmap }> {
  const res = await fetch(url, { signal });
  if (!res.ok) return { data: await blankTile() };
  const bmp = await createImageBitmap(await res.blob(), { premultiplyAlpha: "none", colorSpaceConversion: "none" });
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { data: bmp };
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  edit(img.data, img.width, img.height);
  return { data: await createImageBitmap(img, { premultiplyAlpha: "none", colorSpaceConversion: "none" }) };
}

/**
 * Terrarium heights below sea level are set to zero (RGB 128,0,0). The Bay then reads as one flat
 * water surface, and 3x exaggeration cannot turn the Golden Gate channel into a 300 m trench.
 */
function flattenSeaFloor(d: Uint8ClampedArray) {
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] < 128) {
      d[i] = 128;
      d[i + 1] = 0;
      d[i + 2] = 0;
    }
  }
}

async function toBitmap(w: number, h: number, paint: (out: Uint8ClampedArray) => void): Promise<{ data: ImageBitmap }> {
  const img = new ImageData(w, h);
  paint(img.data);
  return { data: await createImageBitmap(img, { premultiplyAlpha: "none", colorSpaceConversion: "none" }) };
}

export type SlrPaint = "fill" | "band" | "edge";

export function registerProtocols() {
  if (registered) return;
  registered = true;

  // tideslr://{fill|band|edge}/{ft}/{z}/{y}/{x}. A band covers the land between ft and ft + 1.
  maplibregl.addProtocol("tideslr", async (params, abort) => {
    const m = /^tideslr:\/\/(fill|band|edge)\/(\d+)\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
    if (!m) throw new Error(`Bad tile URL ${params.url}`);
    const kind = m[1] as SlrPaint;
    const ft = Number(m[2]);
    const [z, y, x] = [m[3], m[4], m[5]];
    const cur = await classes(ft, z, y, x);
    if (abort.signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (!cur) return { data: await blankTile() };
    if (kind === "edge") return toBitmap(cur.w, cur.h, (out) => paintEdge(out, cur));
    const other = await classes(kind === "fill" ? 0 : Math.min(10, ft + 1), z, y, x);
    if (abort.signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (!other || other.w !== cur.w || other.h !== cur.h) return { data: await blankTile() };
    if (kind === "fill") return toBitmap(cur.w, cur.h, (out) => paintFill(out, cur, other, ft));
    return toBitmap(cur.w, cur.h, (out) => paintBand(out, other, cur, ft + 1));
  });

  maplibregl.addProtocol("tideconf", async (params, abort) => {
    const m = /^tideconf:\/\/(\d+)\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
    if (!m) throw new Error(`Bad tile URL ${params.url}`);
    return repaint(confTileUrl(Number(m[1]), m[2], m[3], m[4]), abort.signal, recolorConfTile);
  });

  maplibregl.addProtocol("tideterrain", async (params, abort) => {
    const m = /^tideterrain:\/\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
    if (!m) throw new Error(`Bad tile URL ${params.url}`);
    return repaint(`${TERRAIN}/${m[1]}/${m[2]}/${m[3]}.png`, abort.signal, flattenSeaFloor);
  });
}

export const TILE_SIZE = SIZE;

