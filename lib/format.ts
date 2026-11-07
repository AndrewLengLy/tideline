import { TZ } from "./time";

const make = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...o });

/** Node and browsers can differ on the narrow no-break space before AM and PM, so one plain space is used everywhere. */
const clean = (s: string) => s.replace(/[\u202f\u00a0]/g, " ");
const fmt = (o: Intl.DateTimeFormatOptions) => {
  const f = make(o);
  return { format: (ms: number) => clean(f.format(ms)), formatToParts: (ms: number) => f.formatToParts(ms) };
};

const WEEKDAY = fmt({ weekday: "long" });
const SHORT_DAY = fmt({ weekday: "short", month: "short", day: "numeric" });
const LONG_DAY = fmt({ weekday: "long", month: "long", day: "numeric" });
const DATE = fmt({ month: "short", day: "numeric", year: "numeric" });
const MONTH_DAY = fmt({ month: "short", day: "numeric" });
const TIME = fmt({ hour: "numeric", minute: "2-digit" });
const FULL = fmt({ weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const ZONE = fmt({ hour: "numeric", timeZoneName: "short" });

export const fmtWeekday = (ms: number) => WEEKDAY.format(ms);
export const fmtShortDay = (ms: number) => SHORT_DAY.format(ms);
export const fmtLongDay = (ms: number) => LONG_DAY.format(ms);
export const fmtDate = (ms: number) => DATE.format(ms);
export const fmtMonthDay = (ms: number) => MONTH_DAY.format(ms);
export const fmtTime = (ms: number) => TIME.format(ms);
export const fmtDateTime = (ms: number) => FULL.format(ms);
export const fmtZone = (ms: number) => ZONE.formatToParts(ms).find((p) => p.type === "timeZoneName")?.value ?? "PT";

/** "Sat, Dec 26, 9:18 AM PST" with the zone printed so every time carries its reference. */
export const fmtAsOf = (ms: number) => `as of ${FULL.format(ms)}`;

/** One decimal, in feet, with the unit. */
export const ft = (v: number, digits = 1) => `${v.toFixed(digits)} ft`;

/** Signed feet, for values relative to a datum. */
export function signedFt(v: number, digits = 1): string {
  const r = Number(v.toFixed(digits));
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(digits)} ft`;
}

export const round1 = (v: number) => Math.round(v * 10) / 10;

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

export function milesAway(mi: number): string {
  return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
}
