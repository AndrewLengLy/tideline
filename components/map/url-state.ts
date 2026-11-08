"use client";

import { parseUrlTime, urlTime } from "@/lib/time";
import type { ViewState } from "./engine";

export interface UrlState {
  t: number | null;
  view: Partial<ViewState>;
  station: string | null;
  ft: number | null;
  compare: boolean;
  play: boolean;
  /** A checked place, from ?pin=lat,lng. */
  pin: { lat: number; lng: number } | null;
}

/** Reads ?t=2026-11-05T14:00Z&lat=&lng=&z=&pitch=&bearing=&station=&ft= from the address bar. */
export function readUrlState(): UrlState {
  const q = new URLSearchParams(window.location.search);
  const num = (k: string) => {
    const v = q.get(k);
    const n = v === null || v === "" ? NaN : Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const ft = num("ft");
  return {
    t: parseUrlTime(q.get("t")),
    view: { lat: num("lat"), lng: num("lng"), zoom: num("z"), pitch: num("pitch"), bearing: num("bearing") },
    station: q.get("station"),
    ft: ft === undefined ? null : Math.max(0, Math.min(10, Math.round(ft))),
    compare: q.get("compare") === "1",
    play: q.get("play") === "1",
    pin: parsePin(q.get("pin")),
  };
}

function parsePin(v: string | null): { lat: number; lng: number } | null {
  const m = v ? /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(v) : null;
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export interface UrlWrite {
  t: number | null;
  view: ViewState | null;
  station: string;
  ft: number;
  compare: boolean;
  pin: { lat: number; lng: number } | null;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: UrlWrite | null = null;

/** Writes state into the URL without a navigation, at most every 300 ms so dragging and playback stay smooth. */
export function writeUrlState(next: UrlWrite) {
  pending = next;
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    const s = pending;
    if (!s) return;
    const q = new URLSearchParams(window.location.search);
    q.delete("play");
    if (s.t === null) q.delete("t");
    else q.set("t", urlTime(s.t));
    if (s.view) {
      q.set("lat", s.view.lat.toFixed(4));
      q.set("lng", s.view.lng.toFixed(4));
      q.set("z", s.view.zoom.toFixed(2));
      q.set("pitch", Math.round(s.view.pitch).toString());
      q.set("bearing", Math.round(s.view.bearing).toString());
    }
    q.set("station", s.station);
    q.set("ft", String(s.ft));
    if (s.pin) q.set("pin", `${s.pin.lat.toFixed(5)},${s.pin.lng.toFixed(5)}`);
    else q.delete("pin");
    if (s.compare) q.set("compare", "1");
    else q.delete("compare");
    const str = q.toString().replace(/%3A/gi, ":");
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${str}`);
  }, 300);
}
