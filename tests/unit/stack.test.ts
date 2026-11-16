import { describe, expect, it } from "vitest";
import { buildStack, hasMerged, kingStep, markerZ } from "@/components/map/stack";

// Tue Nov 24, 2026, 7.7 ft at Alameda, 1.1 ft above an average high tide.
const KING = { t: Date.UTC(2026, 10, 24, 18, 40), height: 7.7, aboveMhhw: 1.1 };

describe("exploded view stack", () => {
  it("stacks average high tide, the king tide step, and the slider from the ground up", () => {
    const s = buildStack(3, KING);
    expect(s.map((x) => [x.ft, x.kind])).toEqual([
      [0, "average"],
      [1, "king"],
      [3, "slider"],
    ]);
    expect(s[0].label).toBe("Average high tide. On a normal day the water stops here.");
    expect(s[1].label).toBe("King tide, Tue Nov 24, 7.7 ft. This is 1.1 ft above an average high tide.");
    expect(s[2].label).toBe("+3 ft of sea level rise. The state's likely range for 2100 is 1.6 to 3.1 ft.");
  });

  it("merges the king tide and the slider when they land on the same foot", () => {
    expect(kingStep(KING)).toBe(1);
    const s = buildStack(1, KING);
    expect(s).toHaveLength(2);
    expect(hasMerged(s)).toBe(true);
    expect(s[1].label).toBe("Same water on two dates. The Nov 24 king tide reaches this line today. With 1 ft of sea level rise, an ordinary high tide reaches it.");
  });

  it("folds a 0 ft slider into the average high tide slab", () => {
    expect(buildStack(0, KING).map((x) => x.kind)).toEqual(["average", "king"]);
  });

  it("keeps the slider slab alone when there is no king tide", () => {
    expect(buildStack(2, null).map((x) => x.kind)).toEqual(["average", "slider"]);
  });

  it("puts the scrubber marker between the right slabs", () => {
    const slabs = buildStack(3, KING);
    const z = (i: number) => (i + 1) * 2700;
    expect(markerZ(-7, slabs, z)).toBe(0);
    expect(markerZ(0, slabs, z)).toBe(2700);
    expect(markerZ(0.5, slabs, z)).toBeCloseTo(4050, 5);
    expect(markerZ(1, slabs, z)).toBe(5400);
    expect(markerZ(3, slabs, z)).toBe(8100);
    // Above the top slab it keeps climbing, capped one gap higher.
    expect(markerZ(9, slabs, z)).toBe(8100 + 2700);
    let prev = -1;
    for (let f = -8; f <= 6; f += 0.25) {
      const v = markerZ(f, slabs, z);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});
