import { describe, expect, it } from "vitest";
import { addDays, dayStart, localSeriesToUtc, localToUtc, noaaDate, pacificDay, parseUrlTime, urlTime } from "@/lib/time";

describe("Pacific time helpers", () => {
  it("reads winter times as PST", () => {
    expect(localToUtc("2026-12-24 11:09")).toBe(Date.UTC(2026, 11, 24, 19, 9));
  });

  it("reads summer times as PDT", () => {
    expect(localToUtc("2027-07-03 23:47")).toBe(Date.UTC(2027, 6, 4, 6, 47));
  });

  it("keeps a series increasing across the repeated hour on November 1, 2026", () => {
    const t = localSeriesToUtc(["2026-11-01 00:54", "2026-11-01 01:00", "2026-11-01 01:54", "2026-11-01 01:00", "2026-11-01 01:06", "2026-11-01 02:00"]);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
    expect(t[1]).toBe(Date.UTC(2026, 10, 1, 8, 0));
    expect(t[3]).toBe(Date.UTC(2026, 10, 1, 9, 0));
    expect(t[5]).toBe(Date.UTC(2026, 10, 1, 10, 0));
  });

  it("assigns instants to Pacific calendar days", () => {
    expect(pacificDay(Date.UTC(2026, 11, 25, 7, 59))).toBe("2026-12-24");
    expect(pacificDay(Date.UTC(2026, 11, 25, 8, 0))).toBe("2026-12-25");
    expect(dayStart("2026-12-25")).toBe(Date.UTC(2026, 11, 25, 8, 0));
  });

  it("adds days across a month end and formats NOAA dates", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-11-03", -5)).toBe("2026-10-29");
    expect(noaaDate("2026-11-06")).toBe("20261106");
  });

  it("round-trips the ?t= value", () => {
    const ms = Date.UTC(2026, 10, 5, 14, 0);
    expect(urlTime(ms)).toBe("2026-11-05T14:00Z");
    expect(parseUrlTime("2026-11-05T14:00Z")).toBe(ms);
    expect(parseUrlTime("nonsense")).toBeNull();
    expect(parseUrlTime(null)).toBeNull();
  });
});
