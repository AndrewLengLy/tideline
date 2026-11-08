import { describe, expect, it } from "vitest";
import { onAPerson, vsHighTide } from "@/lib/format";
import { lightAt, spotsToWatch } from "@/lib/metrics/visit";
import { sliderTip } from "@/components/map/WaterSlider";
import type { MapSpot } from "@/lib/types";

describe("high-tide wording", () => {
  it("never prints a bare negative", () => {
    expect(vsHighTide(-6.12)).toBe("6.1 ft below the high-tide line");
    expect(vsHighTide(1.14)).toBe("1.1 ft over the high-tide line");
    expect(vsHighTide(0.02)).toBe("at the high-tide line");
  });

  it("names depth on a person only above the line", () => {
    expect(onAPerson(-1)).toBeNull();
    expect(onAPerson(0.3)).toBe("ankle deep");
    expect(onAPerson(1.1)).toBe("shin deep");
    expect(onAPerson(6)).toBe("over a person's head");
  });
});

describe("visit planning", () => {
  it("flags a winter evening peak as dark and a midday peak as day", () => {
    expect(lightAt(Date.UTC(2026, 11, 14, 3, 0))).toBe("dark"); // 7 PM PST
    expect(lightAt(Date.UTC(2026, 11, 14, 20, 0))).toBe("day"); // noon PST
  });

  const spot = (slug: string, station: string, reported: boolean, step: number | null, lat = 37.8, lng = -122.3): MapSpot => ({
    slug,
    name: slug,
    lat,
    lng,
    facing: 0,
    nearestStationId: station,
    fact: "",
    floodingReported: reported,
    firstFloodFt: step,
  });

  it("lists the gauge's own spots, reported flooding first, then the lowest step", () => {
    const list = spotsToWatch({ id: "a", lat: 37.8, lng: -122.3 }, [spot("x", "a", false, 1), spot("y", "a", true, 4), spot("z", "b", true, 1), spot("w", "a", false, 3)]);
    expect(list.map((s) => s.slug)).toEqual(["y", "x", "w"]);
  });

  it("falls back to the nearest spots for a gauge with none", () => {
    const list = spotsToWatch({ id: "none", lat: 38, lng: -122 }, [spot("far", "a", false, 2, 37, -123), spot("near", "a", false, 2, 38.01, -122)], 1);
    expect(list[0].slug).toBe("near");
  });
});

describe("slider tips", () => {
  it("explains today's line at 0 ft and ties a king tide to its foot", () => {
    expect(sliderTip(0, 1.1)).toMatch(/today's high-tide line/);
    expect(sliderTip(1, 1.1)).toMatch(/^The next king tide previews this level\. .*2050/);
    expect(sliderTip(3, 1.1)).toMatch(/1\.6 to 3\.1 ft/);
    expect(sliderTip(9, null)).toMatch(/2150/);
  });
});
