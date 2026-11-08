// Buildings whose footprint center sits inside NOAA's mapped water at the step the map shows.
// A screening test: one point per footprint against NOAA's screening-level layer.

export interface FootprintFeature {
  id?: string | number;
  geometry: { type: string; coordinates: unknown };
  properties?: Record<string, unknown> | null;
}

export interface Footprint {
  key: string;
  center: [number, number];
  geometry: { type: "Polygon"; coordinates: number[][][] } | { type: "MultiPolygon"; coordinates: number[][][][] };
  height: number;
  base: number;
}

/** Mean of the outer ring's vertices, closing point excluded. Good enough for building footprints. */
export function ringCenter(ring: number[][]): [number, number] | null {
  const n = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.length - 1 : ring.length;
  if (n < 3) return null;
  let x = 0;
  let y = 0;
  for (let i = 0; i < n; i++) {
    x += ring[i][0];
    y += ring[i][1];
  }
  return [x / n, y / n];
}

/**
 * Turns rendered building features into unique footprints. A building cut by a tile edge comes back
 * as two features, so features with an id dedupe by id and the rest by a rounded center.
 */
export function footprints(features: FootprintFeature[], cap: number): Footprint[] {
  const out: Footprint[] = [];
  const seen = new Set<string>();
  for (const f of features) {
    if (out.length >= cap) break;
    const g = f.geometry;
    let ring: number[][] | null = null;
    if (g.type === "Polygon") ring = (g.coordinates as number[][][])[0] ?? null;
    else if (g.type === "MultiPolygon") ring = (g.coordinates as number[][][][])[0]?.[0] ?? null;
    if (!ring) continue;
    const center = ringCenter(ring);
    if (!center) continue;
    const key = f.id !== undefined && f.id !== null ? `id:${f.id}` : `c:${center[0].toFixed(5)},${center[1].toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const p = f.properties ?? {};
    out.push({
      key,
      center,
      geometry: g as Footprint["geometry"],
      height: typeof p.render_height === "number" ? p.render_height : 4,
      base: typeof p.render_min_height === "number" ? p.render_min_height : 0,
    });
  }
  return out;
}

export function wetCollection(wet: Footprint[]) {
  return {
    type: "FeatureCollection" as const,
    features: wet.map((w) => ({
      type: "Feature" as const,
      geometry: w.geometry,
      properties: { height: w.height + 0.4, base: w.base },
    })),
  };
}

export function wetSentence(n: number, ft: number): string {
  return n === 1
    ? `1 building on screen sits inside the mapped water at ${ft} ft.`
    : `${n.toLocaleString("en-US")} buildings on screen sit inside the mapped water at ${ft} ft.`;
}
