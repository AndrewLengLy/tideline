// Decoded NOAA sea level rise tiles, shared by the map's water layers and by Check a place.
// Kept apart from the map protocols so the place panel can use it without loading MapLibre.
import { decodeSlrTile, FLOODED, LOW, OPEN, slrTileUrl, type SlrClasses } from "@/lib/sources/slr";
import type { PointClass } from "@/lib/metrics/place";

/** Decoded NOAA tiles, shared by the fill, band, and edge paints. 256 tiles hold about 32 MB. */
const CLASS_CACHE_MAX = 256;
const classCache = new Map<string, Promise<SlrClasses | null>>();

async function fetchClasses(ft: number, z: string, y: string, x: string): Promise<SlrClasses | null> {
  const res = await fetch(slrTileUrl(ft, z, y, x));
  if (!res.ok) return null;
  const bmp = await createImageBitmap(await res.blob(), { premultiplyAlpha: "none", colorSpaceConversion: "none" });
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return decodeSlrTile(img.data, img.width, img.height);
}

/** One fetch per step and tile, however many paints ask for it. A paint that is aborted leaves the fetch running for the others. */
export function classes(ft: number, z: string, y: string, x: string): Promise<SlrClasses | null> {
  const key = `${ft}/${z}/${y}/${x}`;
  const hit = classCache.get(key);
  if (hit) {
    classCache.delete(key);
    classCache.set(key, hit);
    return hit;
  }
  const p = fetchClasses(ft, z, y, x).catch(() => null);
  classCache.set(key, p);
  p.then((v) => {
    if (!v) classCache.delete(key);
  });
  while (classCache.size > CLASS_CACHE_MAX) classCache.delete(classCache.keys().next().value!);
  return p;
}


const POINT_ZOOM = 15;

/** NOAA's class for one step at a point, read from the same cached tiles the map draws. */
export async function classAtPoint(ft: number, lng: number, lat: number): Promise<PointClass> {
  const n = 2 ** POINT_ZOOM;
  const fx = ((lng + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  const x = Math.floor(fx);
  const y = Math.floor(fy);
  const c = await classes(ft, String(POINT_ZOOM), String(y), String(x));
  if (!c) return "unknown";
  const px = Math.min(c.w - 1, Math.floor((fx - x) * c.w));
  const py = Math.min(c.h - 1, Math.floor((fy - y) * c.h));
  const v = c.cls[py * c.w + px];
  return v === OPEN ? "open" : v === FLOODED ? "flooded" : v === LOW ? "low" : "dry";
}
