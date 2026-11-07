import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { hexToRgb, STEP_COLORS } from "@/lib/colors";
import { classifySlrPixel, confTileUrl, recolorConfTile, recolorSlrTile, slrTileUrl } from "@/lib/sources/slr";

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
  it("removes NOAA's open water and green and paints flooded land in the step blue", () => {
    const { w, h, data } = decode("slr-6ft-tile.png");
    const before = tally(data);
    expect(before.flooded).toBeGreaterThan(0);
    recolorSlrTile(data, w, h, 6);
    const [r, g, b] = hexToRgb(STEP_COLORS[6]);
    let green = 0;
    let navy = 0;
    let blueish = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      if (data[i] === 85 && data[i + 1] === 255 && data[i + 2] === 0) green++;
      if (data[i] === 9 && data[i + 1] === 9 && data[i + 2] === 145) navy++;
      // Depth darkens the step color toward (6,34,66), so each channel sits between the two.
      const between = (v: number, a: number, c: number) => v >= Math.min(a, c) && v <= Math.max(a, c);
      if (between(data[i], 6, r) && between(data[i + 1], 34, g) && between(data[i + 2], 66, b)) blueish++;
    }
    expect(green).toBe(0);
    expect(navy).toBe(0);
    expect(blueish).toBeGreaterThan(before.flooded * 0.5);
  });

  it("draws an edge only where water meets land, and never on the tile border", () => {
    const w = 8;
    const h = 8;
    const data = new Uint8ClampedArray(w * h * 4);
    // Left half open water, right half dry land.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        if (x < 4) {
          data.set([9, 9, 145, 255], o);
        } else {
          data.set([253, 253, 253, 0], o);
        }
      }
    }
    recolorSlrTile(data, w, h, 3);
    const px = (x: number, y: number) => Array.from(data.slice((y * w + x) * 4, (y * w + x) * 4 + 4));
    expect(px(1, 4)[3]).toBe(0); // open water clears
    expect(px(3, 4)[3]).toBe(255); // shore pixel lights up
    expect(px(3, 0)[3]).toBe(0); // top border stays clear so tile seams never draw
    expect(px(6, 4)[3]).toBe(0); // land stays clear
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
