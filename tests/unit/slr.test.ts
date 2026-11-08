import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { hexToRgb, STEP_COLORS } from "@/lib/colors";
import { classifySlrPixel, confTileUrl, decodeSlrTile, paintBand, paintEdge, paintFill, recolorConfTile, slrTileUrl } from "@/lib/sources/slr";

const decode = (name: string) => {
  const png = PNG.sync.read(readFileSync(join(process.cwd(), "tests", "fixtures", name)));
  return { w: png.width, h: png.height, data: new Uint8ClampedArray(png.data) };
};

function tally(data: Uint8ClampedArray) {
  const out = { dry: 0, water: 0, flooded: 0, "low-lying": 0 };
  for (let i = 0; i < data.length; i += 4) out[classifySlrPixel(data[i], data[i + 1], data[i + 2], data[i + 3])]++;
  return out;
}

describe("NOAA tile classes", () => {
  it("reads the palette", () => {
    expect(classifySlrPixel(253, 253, 253, 0)).toBe("dry");
    expect(classifySlrPixel(9, 9, 145, 255)).toBe("water");
    expect(classifySlrPixel(85, 255, 0, 255)).toBe("low-lying");
    expect(classifySlrPixel(174, 235, 239, 255)).toBe("flooded");
  });

  it("finds more flooded land at 6 ft than at 0 ft in the saved tiles", () => {
    const a = tally(decode("slr-0ft-tile.png").data);
    const b = tally(decode("slr-6ft-tile.png").data);
    expect(b.flooded).toBeGreaterThan(a.flooded);
    expect(b.dry).toBeLessThan(a.dry);
  });

  it("builds tile URLs in z, y, x order", () => {
    expect(slrTileUrl(3, 13, 3166, 1313)).toMatch(/dc_slr\/slr_3ft\/MapServer\/tile\/13\/3166\/1313$/);
    expect(confTileUrl(3, 13, 3166, 1313)).toMatch(/dc_slr\/conf_3ft\/MapServer\/tile\/13\/3166\/1313$/);
  });
});

describe("tile repaint", () => {
  const classesOf = (name: string) => {
    const { w, h, data } = decode(name);
    return decodeSlrTile(data, w, h);
  };
  const wet = (c: number) => c === 1 || c === 2;

  it("paints only land that floods beyond today's high tide in the step blue", () => {
    const base = classesOf("slr-0ft-tile.png");
    const cur = classesOf("slr-6ft-tile.png");
    const out = new Uint8ClampedArray(cur.w * cur.h * 4);
    paintFill(out, cur, base, 6);
    const [r, g, b] = hexToRgb(STEP_COLORS[6]);
    const between = (v: number, a: number, c: number) => v >= Math.min(a, c) && v <= Math.max(a, c);
    let fresh = 0;
    let freshBlue = 0;
    let openPainted = 0;
    for (let i = 0; i < cur.cls.length; i++) {
      const o = i * 4;
      if (cur.cls[i] === 2 && !wet(base.cls[i])) {
        fresh++;
        if (out[o + 3] === 255 && between(out[o], 6, r) && between(out[o + 1], 34, g) && between(out[o + 2], 66, b)) freshBlue++;
      }
      if (cur.cls[i] === 1 && out[o + 3] === 255 && out[o] < 200) openPainted++;
    }
    expect(fresh).toBeGreaterThan(0);
    expect(freshBlue).toBeGreaterThan(fresh * 0.8);
    expect(openPainted).toBe(0);
  });

  it("paints a band only where the upper step is wet and the lower step is not", () => {
    const lower = classesOf("slr-0ft-tile.png");
    const upper = classesOf("slr-6ft-tile.png");
    const out = new Uint8ClampedArray(upper.w * upper.h * 4);
    paintBand(out, upper, lower, 6);
    for (let i = 0; i < upper.cls.length; i++) {
      if (out[i * 4 + 3] === 255 && wet(upper.cls[i])) expect(wet(lower.cls[i])).toBe(false);
      if (wet(lower.cls[i])) expect(out[i * 4 + 3]).toBe(0);
    }
  });

  it("draws the waterline where water meets land, with a dark halo, and never on the tile border", () => {
    const w = 10;
    const h = 10;
    const data = new Uint8ClampedArray(w * h * 4);
    // Left half open water, right half dry land.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) data.set(x < 5 ? [9, 9, 145, 255] : [253, 253, 253, 0], (y * w + x) * 4);
    }
    const out = new Uint8ClampedArray(w * h * 4);
    paintEdge(out, decodeSlrTile(data, w, h));
    const px = (x: number, y: number) => Array.from(out.slice((y * w + x) * 4, (y * w + x) * 4 + 4));
    expect(px(1, 5)[3]).toBe(0); // open water away from shore stays clear
    expect(px(4, 5)[3]).toBe(255); // shore pixel lights up
    expect(px(3, 5)[3]).toBe(255); // the line is two pixels wide
    expect(px(5, 5)[3]).toBe(150); // dark halo on the dry side
    expect(px(7, 5)[3]).toBe(0); // land away from shore stays clear
    expect(px(4, 0)[3]).toBe(0); // top border stays clear so tile seams never draw
  });

  it("turns low confidence into a hatch and clears everything else", () => {
    const { w, h, data } = decode("conf-6ft-tile.png");
    let lowBefore = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] === 255 && data[i + 1] === 170 && data[i + 2] === 0 && data[i + 3] > 128) lowBefore++;
    expect(lowBefore).toBeGreaterThan(0);
    recolorConfTile(data, w, h);
    let hatched = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) {
        hatched++;
        expect([data[i], data[i + 1], data[i + 2]]).toEqual([13, 34, 48]);
      }
    }
    expect(hatched).toBeGreaterThan(0);
    expect(hatched).toBeLessThan(lowBefore);
  });
});
