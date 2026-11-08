"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fmtMonthDay, fmtTime } from "@/lib/format";
import { reportFor, whenRise, type PlaceReport } from "@/lib/metrics/place";
import { searchPlaces, type GeoHit } from "@/lib/sources/geocode";
import type { KingTide, MapStation } from "@/lib/types";
import { classAtPoint } from "../map/slr-cache";

export interface Place {
  lng: number;
  lat: number;
  label: string | null;
}

interface Props {
  place: Place | null;
  onPlace: (p: Place) => void;
  onClear: () => void;
  onShowFt: (ft: number) => void;
  station: MapStation;
  next: KingTide | null;
}

const LINK = "text-link underline";

/** Tap the map or search an address, and see the foot of rise where that spot goes under. */
export function PlaceCheck({ place, onPlace, onClear, onShowFt, station, next }: Props) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<GeoHit[] | null>(null);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ key: string; report: PlaceReport } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const key = place ? `${place.lat},${place.lng}` : null;
  const report = result && result.key === key ? result.report : null;
  const loading = key !== null && !report;

  useEffect(() => {
    if (!place || !key) return;
    let live = true;
    Promise.all(Array.from({ length: 11 }, (_, ft) => classAtPoint(ft, place.lng, place.lat))).then((classes) => {
      if (live) setResult({ key, report: reportFor(classes) });
    });
    return () => {
      live = false;
    };
  }, [place, key]);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (term.length < 3) return;
    abort.current?.abort();
    abort.current = new AbortController();
    setSearchErr(null);
    try {
      const r = await searchPlaces(term, abort.current.signal);
      setHits(r);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setSearchErr("Search is unavailable right now. Tap the map instead.");
    }
  };

  const kingFt = next ? Math.round(next.aboveMhhw) : null;

  return (
    <div className="space-y-4 text-[14px] leading-snug" data-testid="place-check">
      <div>
        <h2 className="text-[17px]">Check a place</h2>
        <p className="mt-0.5 text-muted">Tap anywhere on the map, or search an address.</p>
        <form onSubmit={search} className="mt-2 flex gap-1.5" role="search">
          <label htmlFor="place-q" className="sr-only">
            Address or place in the Bay Area
          </label>
          <input
            id="place-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Address or place"
            autoComplete="street-address"
            className="h-11 min-w-0 flex-1 rounded border border-line bg-panel px-2.5 text-[14px] lg:h-9"
          />
          <button type="submit" className="h-11 rounded border border-ink bg-ink px-3 text-[13px] text-panel lg:h-9">
            Search
          </button>
        </form>
        {searchErr ? <p className="mt-1.5 text-[13px]">{searchErr}</p> : null}
        {hits ? (
          hits.length ? (
            <ul className="mt-1.5 divide-y divide-line rounded border border-line">
              {hits.map((h) => (
                <li key={`${h.lng},${h.lat}`}>
                  <button
                    type="button"
                    className="block min-h-11 w-full px-2.5 py-2 text-left hover:bg-sunk lg:min-h-9"
                    onClick={() => {
                      setHits(null);
                      setQ(h.label);
                      onPlace({ lng: h.lng, lat: h.lat, label: h.label });
                    }}
                  >
                    {h.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-[13px]">No Bay Area match. Try a street and city.</p>
          )
        ) : null}
      </div>

      {place ? (
        <div className="rounded border border-line p-3" aria-live="polite">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold">{place.label ?? "Pinned spot"}</p>
            <button type="button" onClick={onClear} className="shrink-0 text-[13px] text-link underline">
              Clear
            </button>
          </div>
          <p className="num text-[12px] text-muted">
            {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
          </p>
          {loading ? <p className="mt-2">Reading NOAA&apos;s layers for this spot…</p> : null}
          {report ? <Verdict report={report} kingFt={kingFt} next={next} station={station} onShowFt={onShowFt} /> : null}
        </div>
      ) : null}

      <p className="text-[12.5px] text-muted">
        NOAA&apos;s layers are a screening tool. They leave out storms, waves, and drainage, so treat a result as a first look. <Link className={LINK} href="/methodology">How this works</Link>
      </p>
    </div>
  );
}

function Verdict({ report, kingFt, next, station, onShowFt }: { report: PlaceReport; kingFt: number | null; next: KingTide | null; station: MapStation; onShowFt: (ft: number) => void }) {
  const { today, firstWetFt, firstLowFt, partial } = report;
  const showBtn = (ft: number) => (
    <button type="button" onClick={() => onShowFt(ft)} className="mt-2 inline-flex h-11 items-center rounded border border-ink px-2.5 text-[13px] hover:bg-sunk lg:h-8">
      Show {ft} ft on the map
    </button>
  );
  return (
    <div className="mt-2 space-y-1.5">
      {today === "open" ? <p className="text-[16px] font-medium">Open water at today&apos;s high tide.</p> : null}
      {today === "wet" ? (
        <p>
          <span className="text-[16px] font-medium">Already wet at today&apos;s high tide.</span> NOAA maps it as marsh, a pond, or shore that ordinary tides cover now.
        </p>
      ) : null}
      {!today && firstWetFt !== null ? (
        <>
          <p className="num text-[22px] font-medium leading-tight">Goes under at {firstWetFt} ft</p>
          <p>{whenRise(firstWetFt)}.</p>
          {next && kingFt !== null && kingFt >= firstWetFt ? (
            <p>
              The king tide on <span className="num">{fmtMonthDay(next.t)}</span> previews this. Water at {station.name} peaks at <span className="num">{fmtTime(next.t)}</span>, so go look then.
            </p>
          ) : null}
          {showBtn(firstWetFt)}
        </>
      ) : null}
      {!today && firstLowFt !== null && (firstWetFt === null || firstLowFt < firstWetFt) ? (
        <p>
          From <span className="num">{firstLowFt} ft</span>, it sits below the water level with higher ground between it and the Bay. Storm drains or a failed levee could still flood it.
        </p>
      ) : null}
      {!today && firstWetFt === null ? (
        <>
          <p className="text-[16px] font-medium">Stays dry through 10 ft of rise.</p>
          <p>That is the highest step NOAA maps.</p>
        </>
      ) : null}
      {partial ? <p className="text-[12.5px] text-muted">Some NOAA tiles did not load, so this answer may be incomplete.</p> : null}
    </div>
  );
}
