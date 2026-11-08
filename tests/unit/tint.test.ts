import { describe, expect, it } from "vitest";
import { buildLut, IMAGERY_RAMP, tintPixels } from "@/components/map/tint";

const rgb = (lut: Uint8ClampedArray, i: number) => [lut[i * 3], lut[i * 3 + 1], lut[i * 3 + 2]];

describe("buildLut", () => {
  it("starts and ends on the end stops", () => {
    const lut = buildLut([[0, "#000000"], [1, "#ffffff"]]);
    expect(rgb(lut, 0)).toEqual([0, 0, 0]);
    expect(rgb(lut, 255)).toEqual([255, 255, 255]);
  });

  it("places a middle entry between its neighbors", () => {
    const lut = buildLut(IMAGERY_RAMP);
    const mid = rgb(lut, 128);
    const lo = rgb(lut, 64);
    const hi = rgb(lut, 200);
    for (let c = 0; c < 3; c++) {
      expect(mid[c]).toBeGreaterThanOrEqual(lo[c]);
      expect(mid[c]).toBeLessThanOrEqual(hi[c]);
    }
  });

  it("hits an inner stop exactly", () => {
    const lut = buildLut([[0, "#000000"], [0.5, "#ff0000"], [1, "#ffffff"]]);
    const [r] = rgb(lut, 128);
    expect(r).toBeGreaterThan(250);
  });
});

describe("tintPixels", () => {
  it("maps a pixel onto the ramp and keeps alpha", () => {
    const lut = buildLut([[0, "#000000"], [1, "#0000ff"]]);
    const px = new Uint8ClampedArray([255, 255, 255, 77]);
    tintPixels(px, lut, 1, 0);
    expect(Array.from(px)).toEqual([0, 0, 255, 77]);
  });

  it("keeps part of the photo when asked", () => {
    const lut = buildLut([[0, "#000000"], [1, "#000000"]]);
    const px = new Uint8ClampedArray([200, 100, 50, 255]);
    tintPixels(px, lut, 1, 0.5);
    expect(Array.from(px)).toEqual([100, 50, 25, 255]);
  });
});
