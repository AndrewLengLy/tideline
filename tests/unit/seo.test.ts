import { describe, expect, it } from "vitest";
import { MAX_DESCRIPTION, MAX_TITLE, spotMeta, stationMeta, TITLE_SUFFIX } from "@/lib/seo";
import { SPOTS } from "@/lib/spots";
import { stationById, STATIONS } from "@/lib/stations";
import type { KingTide, StationOverview } from "@/lib/types";

const worst = (stationId: string): StationOverview => {
  const next: KingTide = { stationId, stationName: "x", stationSlug: "x", t: Date.UTC(2026, 11, 24, 19), height: 10.5, aboveMhhw: 1.5 };
  return {
    stationId,
    kingTides: [next],
    next,
    daysOver: [
      { addFt: 0, days: 365 },
      { addFt: 3, days: 365 },
    ],
    thresholdKind: "minor",
    thresholdFt: 1.9,
    highCount: 700,
  };
};

describe("page metadata", () => {
  it("keeps every station title and description inside the limits", () => {
    for (const s of STATIONS) {
      const m = stationMeta(s, worst(s.id));
      expect((m.title + TITLE_SUFFIX).length, m.title).toBeLessThan(MAX_TITLE);
      expect(m.description.length, m.description).toBeLessThan(MAX_DESCRIPTION);
    }
  });

  it("keeps every spot title and description inside the limits, and all are unique", () => {
    const titles = new Set<string>();
    for (const s of SPOTS) {
      const name = stationById(s.nearestStationId)?.name ?? "";
      const m = spotMeta(s, worst(s.nearestStationId), name);
      expect((m.title + TITLE_SUFFIX).length, m.title).toBeLessThan(MAX_TITLE);
      expect(m.description.length, m.description).toBeLessThan(MAX_DESCRIPTION);
      titles.add(m.title);
    }
    expect(titles.size).toBe(SPOTS.length);
  });
});

describe("shoreline spots", () => {
  it("lists 15 spots with a source, a fact, and a step result for every foot", () => {
    expect(SPOTS).toHaveLength(15);
    for (const s of SPOTS) {
      expect(s.slug).toMatch(/^[a-z0-9-]+$/);
      expect(s.fact.length).toBeGreaterThan(20);
      expect(s.sourceUrl).toMatch(/^https:\/\//);
      expect(s.steps).toHaveLength(11);
      expect(stationById(s.nearestStationId)).toBeDefined();
      if (s.firstFloodFt !== null) expect(s.steps[s.firstFloodFt]).toBe("flooded");
    }
  });
});
