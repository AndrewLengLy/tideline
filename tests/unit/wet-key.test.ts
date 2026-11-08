import { describe, expect, it } from "vitest";
import { deriveKeyEvents } from "@/components/app/KeyEvents";
import { footprints, ringCenter, wetCollection, wetSentence } from "@/components/map/wet-buildings";

const square = (x: number, y: number, d = 0.001) => [
  [x, y],
  [x + d, y],
  [x + d, y + d],
  [x, y + d],
  [x, y],
];

describe("wet buildings", () => {
  it("finds a ring center without counting the closing point twice", () => {
    expect(ringCenter(square(0, 0, 2))).toEqual([1, 1]);
  });

  it("dedupes split features by id and by center", () => {
    const a = { id: 7, geometry: { type: "Polygon", coordinates: [square(-122.4, 37.8)] }, properties: { render_height: 12 } };
    const b = { id: 7, geometry: { type: "Polygon", coordinates: [square(-122.4005, 37.8)] }, properties: {} };
    const c = { geometry: { type: "Polygon", coordinates: [square(-122.41, 37.8)] }, properties: {} };
    const d = { geometry: { type: "Polygon", coordinates: [square(-122.41, 37.8)] }, properties: {} };
    const out = footprints([a, b, c, d], 100);
    expect(out).toHaveLength(2);
    expect(out[0].height).toBe(12);
    expect(out[1].height).toBe(4);
  });

  it("respects the cap and lifts wet roofs above the base layer", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ geometry: { type: "Polygon", coordinates: [square(i, 0)] }, properties: {} }));
    const out = footprints(many, 3);
    expect(out).toHaveLength(3);
    expect(wetCollection(out).features[0].properties.height).toBeCloseTo(4.4);
  });

  it("writes the count sentence", () => {
    expect(wetSentence(1, 3)).toBe("1 building on screen sits inside the mapped water at 3 ft.");
    expect(wetSentence(1200, 4)).toBe("1,200 buildings on screen sit inside the mapped water at 4 ft.");
  });
});

describe("deriveKeyEvents", () => {
  const STEP = 6 * 60_000;
  // Two Pacific days of a simple tide, starting at midnight PST on Nov 3, 2026.
  const t0 = Date.UTC(2026, 10, 3, 8);
  const n = (2 * 24 * 60) / 6;
  const predicted = new Float32Array(n);
  for (let i = 0; i < n; i++) predicted[i] = 3 + 3 * Math.sin((i / n) * 8 * Math.PI) + (i > n / 2 ? 0.5 : 0);

  it("lists one high per day, sorted, with a king tide replacing its day's high", () => {
    const plain = deriveKeyEvents({ t0, stepMs: STEP, predicted, kings: [], crossings: [], surge: null });
    expect(plain.filter((e) => e.kind === "high")).toHaveLength(2);
    const kingIndex = n - 10;
    const withKing = deriveKeyEvents({
      t0,
      stepMs: STEP,
      predicted,
      kings: [{ index: kingIndex, at: t0 + kingIndex * STEP, kind: "king", label: "King tide, 6.9 ft" }],
      crossings: [],
      surge: { at: t0 + 30 * STEP, maxFt: 0.42 },
    });
    expect(withKing.filter((e) => e.kind === "high")).toHaveLength(1);
    expect(withKing.map((e) => e.kind)).toContain("surge");
    const times = withKing.map((e) => e.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});
