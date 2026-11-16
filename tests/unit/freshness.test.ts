import { describe, expect, it } from "vitest";
import { ageWords, cacheBucket, checkAge, oldReading, PREDICTION_REFRESH_MS, PREDICTION_WARN_MS, READING_REFETCH_MS, READING_WARN_MS } from "@/lib/metrics/freshness";
import { DAY, HOUR, MINUTE } from "@/lib/time";

const NOW = Date.UTC(2026, 10, 16, 17, 58);

describe("reading freshness", () => {
  it("keeps a first reading up to 30 minutes old", () => {
    expect(READING_REFETCH_MS).toBe(30 * MINUTE);
    expect(checkAge(NOW - 29 * MINUTE, NOW, false)).toBe("fresh");
    expect(checkAge(NOW - 30 * MINUTE, NOW, false)).toBe("fresh");
  });

  it("asks again when the first reading is more than 30 minutes old", () => {
    expect(checkAge(NOW - 31 * MINUTE, NOW, false)).toBe("updating");
    // The Nov 16 case: a STALE CDN copy from Nov 12 at 06:06 UTC.
    expect(checkAge(Date.UTC(2026, 10, 12, 6, 6), NOW, false)).toBe("updating");
  });

  it("shows the second reading as is up to 2 hours old", () => {
    expect(READING_WARN_MS).toBe(2 * HOUR);
    expect(checkAge(NOW - 45 * MINUTE, NOW, true)).toBe("fresh");
    expect(checkAge(NOW - 2 * HOUR, NOW, true)).toBe("fresh");
  });

  it("warns when the second reading is still more than 2 hours old", () => {
    expect(checkAge(NOW - 2 * HOUR - MINUTE, NOW, true)).toBe("old");
    expect(oldReading(Date.UTC(2026, 10, 12, 6, 6), NOW)).toBe("Last reading 4 days ago. NOAA may be down for this gauge.");
  });

  it("uses wider windows for predictions, which refresh daily", () => {
    expect(checkAge(NOW - 90 * MINUTE, NOW, false, PREDICTION_REFRESH_MS, PREDICTION_WARN_MS)).toBe("fresh");
    expect(checkAge(NOW - 3 * HOUR, NOW, false, PREDICTION_REFRESH_MS, PREDICTION_WARN_MS)).toBe("updating");
    expect(checkAge(NOW - 25 * HOUR, NOW, true, PREDICTION_REFRESH_MS, PREDICTION_WARN_MS)).toBe("fresh");
    expect(checkAge(NOW - 27 * HOUR, NOW, true, PREDICTION_REFRESH_MS, PREDICTION_WARN_MS)).toBe("old");
  });

  it("rounds ages down and spells them out", () => {
    expect(ageWords(4.6 * DAY)).toBe("4 days");
    expect(ageWords(DAY + HOUR)).toBe("1 day");
    expect(ageWords(2 * HOUR + 59 * MINUTE)).toBe("2 hours");
    expect(ageWords(40 * MINUTE)).toBe("40 minutes");
  });

  it("buckets cache-busting queries by 5 minutes, so visitors still share a CDN copy", () => {
    const t = Date.UTC(2026, 10, 16, 18, 0);
    expect(cacheBucket(t)).toBe(cacheBucket(t + 4 * MINUTE + 59_000));
    expect(cacheBucket(t + 5 * MINUTE)).toBe(cacheBucket(t) + 1);
  });
});
