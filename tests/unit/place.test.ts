import { describe, expect, it } from "vitest";
import { reportFor, whenRise, type PointClass } from "@/lib/metrics/place";
import { photonLabel } from "@/lib/sources/geocode";

const steps = (...c: PointClass[]) => [...c, ...Array<PointClass>(11 - c.length).fill(c[c.length - 1])];

describe("place report", () => {
  it("finds the first foot where the point is connected water", () => {
    expect(reportFor(steps("dry", "dry", "dry", "flooded"))).toMatchObject({ today: null, firstWetFt: 3, firstLowFt: null });
  });

  it("reports low-lying land apart from flooding", () => {
    expect(reportFor(steps("dry", "low", "low", "low", "flooded"))).toMatchObject({ firstWetFt: 4, firstLowFt: 1 });
    expect(reportFor(steps("dry", "dry", "low"))).toMatchObject({ firstWetFt: null, firstLowFt: 2 });
  });

  it("names open water and marsh that are wet today", () => {
    expect(reportFor(steps("open")).today).toBe("open");
    expect(reportFor(steps("flooded")).today).toBe("wet");
  });

  it("stays dry through 10 ft and flags missing tiles", () => {
    expect(reportFor(steps("dry"))).toMatchObject({ firstWetFt: null, partial: false });
    expect(reportFor(["dry", "unknown", ...Array<PointClass>(9).fill("dry")]).partial).toBe(true);
  });
});

describe("when the state expects a rise", () => {
  it("uses the 2024 statewide figures", () => {
    expect(whenRise(0)).toMatch(/Today/);
    expect(whenRise(0.5)).toMatch(/2050/);
    expect(whenRise(1)).toBe("Around 2055 in the state's intermediate scenario");
    expect(whenRise(2)).toBe("Around 2075 in the state's intermediate scenario");
    expect(whenRise(5)).toMatch(/high scenario/);
    expect(whenRise(8)).toMatch(/After 2100/);
  });
});

describe("geocoder labels", () => {
  it("joins a street address and city without repeats", () => {
    expect(photonLabel({ housenumber: "1", street: "Ferry Building", city: "San Francisco" })).toBe("1 Ferry Building, San Francisco");
    expect(photonLabel({ name: "Crissy Field", city: "San Francisco" })).toBe("Crissy Field, San Francisco");
    expect(photonLabel({ name: "Alameda", city: "Alameda" })).toBe("Alameda");
  });
});
