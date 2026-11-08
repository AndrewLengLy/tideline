// Recolors imagery through a color ramp. MapLibre has no raster-color, so the imagery protocol
// repaints each tile with these functions. The channel weights match FireTrace's raster-color-mix.

/** [position 0..1, hex] stops, the same shape as a Mapbox raster-color ramp. */
export type RampStop = readonly [number, string];

/** Cool gray ramp so the blue water steps and coral marks carry the page. */
export const IMAGERY_RAMP: readonly RampStop[] = [
  [0, "#21384a"],
  [0.35, "#5f7786"],
  [0.7, "#b9c8d0"],
  [1, "#f3f6f7"],
];
export const IMAGERY_CONTRAST = 1.08;
/** Share of the original photo kept, so marsh, mudflat, and pavement still read differently. */
export const IMAGERY_PHOTO = 0.25;

export function buildLut(stops: readonly RampStop[]): Uint8ClampedArray {
  const s = stops.map(([t, hex]) => [t, ...[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))]);
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < s.length - 2 && t > s[k + 1][0]) k++;
    const a = s[k];
    const b = s[k + 1];
    const f = Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0] || 1)));
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = a[c + 1] + (b[c + 1] - a[c + 1]) * f;
  }
  return lut;
}

/** Repaints RGBA pixels in place. Alpha is left alone. */
export function tintPixels(d: Uint8ClampedArray, lut: Uint8ClampedArray, contrast = 1.1, photo = 0.1) {
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.36 * d[i] + 0.5 * d[i + 1] + 0.14 * d[i + 2];
    const j = Math.max(0, Math.min(255, Math.round((lum - 128) * contrast + 128))) * 3;
    d[i] = lut[j] + (d[i] - lut[j]) * photo;
    d[i + 1] = lut[j + 1] + (d[i + 1] - lut[j + 1]) * photo;
    d[i + 2] = lut[j + 2] + (d[i + 2] - lut[j + 2]) * photo;
  }
}
