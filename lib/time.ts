// NOAA serves local standard/daylight time for San Francisco Bay stations (time_zone=lst_ldt).
// These helpers move between those local strings and UTC milliseconds.
export const TZ = "America/Los_Angeles";
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function pacificParts(ms: number): Parts {
  const out: Record<string, number> = {};
  for (const p of partsFormat.formatToParts(new Date(ms))) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out as unknown as Parts;
}

/** Offset of Pacific time from UTC at an instant, in milliseconds. Negative in California. */
export function pacificOffset(ms: number): number {
  const p = pacificParts(ms);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - (ms - ms % 1000);
}

/** Converts "2026-11-06 03:10" in Pacific local time to UTC ms. An ambiguous fall-back time resolves to its first occurrence. */
export function localToUtc(local: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(local);
  if (!m) throw new Error(`Unrecognized local time: ${local}`);
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Try the earlier (daylight) offset first so the first occurrence wins in the repeated hour.
  const candidates = [-7 * HOUR, -8 * HOUR].map((o) => wall - o);
  for (const c of candidates) if (c + pacificOffset(c) === wall) return c;
  // A wall time in the skipped spring hour has no match. Use standard time.
  return wall + 8 * HOUR;
}

/** Converts an ordered series of local times to UTC ms, keeping the series increasing across the repeated November hour. */
export function localSeriesToUtc(locals: string[]): number[] {
  const out: number[] = [];
  let prev = -Infinity;
  for (const s of locals) {
    let t = localToUtc(s);
    if (t <= prev) t += HOUR;
    out.push(t);
    prev = t;
  }
  return out;
}

/** "2026-11-06" for the Pacific calendar day holding this instant. */
export function pacificDay(ms: number): string {
  const p = pacificParts(ms);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** UTC ms at local midnight for a "YYYY-MM-DD" Pacific day. */
export function dayStart(day: string): number {
  return localToUtc(`${day} 00:00`);
}

/** Adds whole calendar days to a "YYYY-MM-DD" string. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** "20261106" for NOAA's begin_date and end_date, read as local time under lst_ldt. */
export function noaaDate(day: string): string {
  return day.replaceAll("-", "");
}

/** Value for the ?t= parameter: 2026-11-05T14:00Z. */
export function urlTime(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16) + "Z";
}

export function parseUrlTime(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = /T\d{2}:\d{2}Z$/.test(raw) ? raw.replace("Z", ":00Z") : raw;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}
