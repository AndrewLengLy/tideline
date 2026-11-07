import { describe, expect, it } from "vitest";
import { deltaE, lightness, simulateDeuteranopia } from "@/lib/colorblind";
import { COLOR, STEP_COLORS } from "@/lib/colors";

describe("sea level rise scale under deuteranopia", () => {
  it("has 11 steps, one per foot", () => {
    expect(STEP_COLORS).toHaveLength(11);
  });

  it("gets darker at every step, in normal vision and simulated", () => {
    for (let i = 1; i < STEP_COLORS.length; i++) {
      expect(lightness(STEP_COLORS[i])).toBeLessThan(lightness(STEP_COLORS[i - 1]));
      expect(lightness(simulateDeuteranopia(STEP_COLORS[i]))).toBeLessThan(lightness(simulateDeuteranopia(STEP_COLORS[i - 1])));
    }
  });

  it("keeps adjacent steps apart when simulated", () => {
    for (let i = 1; i < STEP_COLORS.length; i++) {
      expect(deltaE(simulateDeuteranopia(STEP_COLORS[i]), simulateDeuteranopia(STEP_COLORS[i - 1]))).toBeGreaterThan(4);
    }
  });

  it("keeps flood coral apart from water blue when simulated", () => {
    expect(deltaE(simulateDeuteranopia(COLOR.coral), simulateDeuteranopia(COLOR.water))).toBeGreaterThan(25);
  });
});
