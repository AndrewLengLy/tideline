// Point query against the NOAA sea level rise layers. For each place, reads the pixels around it
// in the level 16 tiles at every foot from 0 to 10, then records the first step that floods it.
// Writes data/spots.json. The layers change rarely, so this runs by hand and the result is committed.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { lngLatToPixel, offsetMeters } from "../lib/geo";
import { classifySlrPixel, SLR_MAX_ZOOM, SLR_STEPS, slrTileUrl } from "../lib/sources/slr";
import { nearestStation } from "../lib/stations";
import type { Place, SlrStatus, Spot } from "../lib/types";

interface SpotSeed {
  slug: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  facing: number;
  fact: string;
  sourceName: string;
  sourceUrl: string;
  floodingReported: boolean;
}

interface PlaceSeed {
  name: string;
  lat: number;
  lng: number;
  /** Half-width of the sampled square, meters. Wide places flood when half of their land is wet. */
  radius: number;
}

const ROOT = process.cwd();
const seeds = JSON.parse(readFileSync(join(ROOT, "data", "spot-seeds.json"), "utf8")) as { spots: SpotSeed[]; places: PlaceSeed[] };

const tileCache = new Map<string, Promise<PNG | null>>();

async function fetchTile(ft: number, x: number, y: number): Promise<PNG | null> {
  const url = slrTileUrl(ft, SLR_MAX_ZOOM, y, x);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "tideline/0.1 (+https://tides.andrewlengly.com)" }, signal: AbortSignal.timeout(30_000) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return PNG.sync.read(Buffer.from(await res.arrayBuffer()));
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return null;
}

function tile(ft: number, x: number, y: number) {
  const key = `${ft}/${x}/${y}`;
  let hit = tileCache.get(key);
  if (!hit) {
    hit = fetchTile(ft, x, y);
    tileCache.set(key, hit);
  }
  return hit;
}

async function pixelClass(ft: number, lat: number, lng: number): Promise<SlrStatus> {
  const { x, y } = lngLatToPixel(lat, lng, SLR_MAX_ZOOM);
  const tx = Math.floor(x / 256);
  const ty = Math.floor(y / 256);
  const png = await tile(ft, tx, ty);
  if (!png) return "dry";
  const px = Math.floor(x - tx * 256);
  const py = Math.floor(y - ty * 256);
  const o = (py * png.width + px) * 4;
  return classifySlrPixel(png.data[o], png.data[o + 1], png.data[o + 2], png.data[o + 3]);
}

function grid(lat: number, lng: number, radius: number, n: number): { lat: number; lng: number }[] {
  const out: { lat: number; lng: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const f = (k: number) => (n === 1 ? 0 : -radius + (2 * radius * k) / (n - 1));
      out.push(offsetMeters(lat, lng, f(i), f(j)));
    }
  }
  return out;
}

interface QueryResult {
  firstFloodFt: number | null;
  firstLowLyingFt: number | null;
  steps: SlrStatus[];
  landShare: number;
}

/**
 * Open water at 0 ft is left out of every count, so a shoreline point is judged on its land alone.
 * A step floods the place when at least `share` of that land is wet and connected.
 */
async function query(lat: number, lng: number, radius: number, n: number, share: number): Promise<QueryResult> {
  const points = grid(lat, lng, radius, n);
  const base = await Promise.all(points.map((p) => pixelClass(0, p.lat, p.lng)));
  const land = points.filter((_, i) => base[i] !== "water");
  const steps: SlrStatus[] = [];
  let firstFloodFt: number | null = null;
  let firstLowLyingFt: number | null = null;
  for (const ft of SLR_STEPS) {
    const cls = await Promise.all(land.map((p) => pixelClass(ft, p.lat, p.lng)));
    const wet = cls.filter((c) => c === "flooded" || c === "water").length;
    const low = cls.filter((c) => c === "low-lying").length;
    const total = Math.max(1, land.length);
    let status: SlrStatus = "dry";
    if (land.length === 0) status = "water";
    else if (wet / total >= share) status = "flooded";
    else if ((wet + low) / total >= share) status = "low-lying";
    steps.push(status);
    if (status === "flooded" && firstFloodFt === null) firstFloodFt = ft;
    if (status === "low-lying" && firstLowLyingFt === null) firstLowLyingFt = ft;
  }
  return { firstFloodFt, firstLowLyingFt, steps, landShare: land.length / points.length };
}

async function main() {
  const spots: Spot[] = [];
  const places: Place[] = [];
  for (const s of seeds.spots) {
    // Within about 15 m of the point: a quarter of its land wet counts as reaching the spot.
    const q = await query(s.lat, s.lng, 15, 5, 0.25);
    const near = nearestStation(s.lat, s.lng);
    spots.push({
      ...s,
      nearestStationId: near.station.id,
      nearestStationMi: Number(near.miles.toFixed(1)),
      firstFloodFt: q.firstFloodFt,
      firstLowLyingFt: q.firstLowLyingFt,
      steps: q.steps,
    });
    places.push({ name: s.name, lat: s.lat, lng: s.lng, firstFloodFt: q.firstFloodFt, spotSlug: s.slug });
    console.log(`${s.slug.padEnd(38)} floods ${String(q.firstFloodFt).padEnd(5)} low ${String(q.firstLowLyingFt).padEnd(5)} land ${(q.landShare * 100).toFixed(0).padStart(3)}%  ${q.steps.map((c) => c[0]).join("")}  gauge ${near.station.name} ${near.miles.toFixed(1)} mi`);
  }
  for (const p of seeds.places) {
    const q = await query(p.lat, p.lng, p.radius, 7, 0.5);
    places.push({ name: p.name, lat: p.lat, lng: p.lng, firstFloodFt: q.firstFloodFt });
    console.log(`${p.name.padEnd(38)} floods ${String(q.firstFloodFt).padEnd(5)} low ${String(q.firstLowLyingFt).padEnd(5)} land ${(q.landShare * 100).toFixed(0).padStart(3)}%  ${q.steps.map((c) => c[0]).join("")}`);
  }
  const out = { checkedAt: new Date().toISOString(), spots, places };
  writeFileSync(join(ROOT, "data", "spots.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${spots.length} spots and ${places.length} places. Tiles fetched: ${tileCache.size}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
