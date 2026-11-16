// How old a printed reading may be before the page asks again, and the words for each state.
// A CDN or ISR copy can outlive a quiet stretch, so the browser checks the time on what it got.
import { DAY, HOUR, MINUTE } from "../time";

/** Observed gauge readings arrive every 6 minutes. Older than this, the browser asks once more. */
export const READING_REFETCH_MS = 30 * MINUTE;
/** A reading still this old after the second request means the gauge has gone quiet. */
export const READING_WARN_MS = 2 * HOUR;
/** The map page rebuilds hourly, so its predictions older than this came from a stale copy. */
export const PREDICTION_REFRESH_MS = 2 * HOUR;
/** Predictions refresh once a day by cron. Past this, the page says how old they are. */
export const PREDICTION_WARN_MS = 26 * HOUR;

export type Freshness = "fresh" | "updating" | "old";

/**
 * The state of a printed time. The first copy asks again once it passes `refetchMs`. The second
 * copy is shown as is, unless it is still older than `warnMs`.
 */
export function checkAge(asOf: number, now: number, retried: boolean, refetchMs = READING_REFETCH_MS, warnMs = READING_WARN_MS): Freshness {
  const age = now - asOf;
  if (!retried) return age > refetchMs ? "updating" : "fresh";
  return age > warnMs ? "old" : "fresh";
}

/** The current 5-minute bucket, for a cache-busting query that the CDN can still share between visitors. */
export const cacheBucket = (now: number) => Math.floor(now / (5 * MINUTE));

/** "4 days", "1 day", "3 hours", "40 minutes". Rounded down, so it never overstates. */
export function ageWords(ms: number): string {
  const days = Math.floor(ms / DAY);
  if (days >= 1) return days === 1 ? "1 day" : `${days} days`;
  const hours = Math.floor(ms / HOUR);
  if (hours >= 1) return hours === 1 ? "1 hour" : `${hours} hours`;
  const minutes = Math.max(1, Math.floor(ms / MINUTE));
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

export const UPDATING_READING = "Updating to the latest reading";
export const UPDATING_PREDICTION = "Updating to the latest prediction";

export const oldReading = (asOf: number, now: number) => `Last reading ${ageWords(now - asOf)} ago. NOAA may be down for this gauge.`;
export const oldPrediction = (asOf: number, now: number) => `Predictions last updated ${ageWords(now - asOf)} ago. They return on the next refresh.`;
