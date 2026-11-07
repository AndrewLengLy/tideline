import { futureTideEquivalent } from "./king-tides";
import { SITE_URL } from "../site";
import { MINUTE } from "../time";
import type { KingTide } from "../types";

const LEAD_MINUTES = 30;
const DURATION_MINUTES = 60;

const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escapeText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

const encoder = new TextEncoder();
const octets = (s: string) => encoder.encode(s).length;

/** RFC 5545 line folding at 75 octets. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  let limit = 75;
  while (octets(rest) > limit) {
    let cut = limit;
    while (octets(rest.slice(0, cut)) > limit) cut--;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut);
    limit = 74;
  }
  out.push(rest);
  return out.join("\r\n ");
}

/** An .ics calendar file for one tide. The event starts 30 minutes before the predicted peak. */
export function buildIcs(k: KingTide, createdAt: number): string {
  const start = k.t - LEAD_MINUTES * MINUTE;
  const end = start + DURATION_MINUTES * MINUTE;
  const eq = futureTideEquivalent(k.aboveMhhw).toFixed(1);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tideline//King Tide Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${k.stationId}-${stamp(k.t)}@tides.andrewlengly.com`,
    `DTSTAMP:${stamp(createdAt)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeText(`King tide at ${k.stationName}, ${k.height.toFixed(1)} ft`)}`,
    `DESCRIPTION:${escapeText(`Predicted peak ${k.height.toFixed(1)} ft above MLLW at the ${k.stationName} gauge, ${eq} ft above MHHW. The event starts 30 minutes before the peak. Prediction from NOAA CO-OPS. ${SITE_URL}/stations/${k.stationSlug}`)}`,
    `LOCATION:${escapeText(`${k.stationName} tide gauge, San Francisco Bay`)}`,
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function icsFileName(k: KingTide): string {
  return `king-tide-${k.stationSlug}-${new Date(k.t).toISOString().slice(0, 10)}.ics`;
}
