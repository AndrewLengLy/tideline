"use client";

import Link from "next/link";
import { useState } from "react";
import { fmtMonthDay } from "@/lib/format";
import { addDays, dayStart } from "@/lib/time";
import type { MapSpot, MapStation } from "@/lib/types";

interface Props {
  stations: MapStation[];
  spots: MapSpot[];
  stationId: string;
  onStation: (id: string) => void;
  onSpot: (slug: string) => void;
  from: string;
  onShiftWeek: (days: number) => void;
  onNow: () => void;
  onNextKing: (() => void) | null;
}

export function DateRange({ from, onShiftWeek, onNow, onNextKing, className = "" }: Pick<Props, "from" | "onShiftWeek" | "onNow" | "onNextKing"> & { className?: string }) {
  const start = dayStart(from) + 43_200_000;
  const end = dayStart(addDays(from, 6)) + 43_200_000;
  const btn = "flex h-11 min-w-11 items-center justify-center px-1.5 text-[13px] text-ink hover:bg-sunk lg:h-8 lg:min-w-8";
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center overflow-hidden rounded border border-line bg-panel">
        <button type="button" className={btn} onClick={() => onShiftWeek(-7)} aria-label="Previous week">
          <span aria-hidden>‹</span>
        </button>
        <span className="num whitespace-nowrap px-1 text-[12.5px]" data-testid="date-range">
          {fmtMonthDay(start)} to {fmtMonthDay(end)}
        </span>
        <button type="button" className={btn} onClick={() => onShiftWeek(7)} aria-label="Next week">
          <span aria-hidden>›</span>
        </button>
      </div>
      <button type="button" className={`${btn} rounded border border-line bg-panel`} onClick={onNow}>
        Now
      </button>
      {onNextKing ? (
        <button type="button" className={`${btn} whitespace-nowrap rounded border border-line bg-panel`} onClick={onNextKing}>
          Next king tide
        </button>
      ) : null}
    </div>
  );
}

export function TopBar({ stations, spots, stationId, onStation, onSpot, from, onShiftWeek, onNow, onNextKing }: Props) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share && window.matchMedia("(pointer: coarse)").matches) {
      await nav.share({ title: "Tideline", url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <header className="absolute inset-x-0 top-0 z-30 flex h-[52px] items-center gap-2 border-b border-line bg-panel px-3 lg:h-12 lg:gap-3">
      <Link href="/" className="text-[19px] font-bold leading-none tracking-tight text-ink no-underline">
        Tideline
      </Link>
      <span className="hidden h-5 w-px bg-line lg:block" aria-hidden />
      <label className="min-w-0 flex-1 lg:max-w-[230px] lg:flex-none">
        <span className="sr-only">Station or shoreline spot</span>
        <select
          className="h-11 w-full min-w-0 cursor-pointer truncate rounded border border-line bg-panel px-2 text-[15px] text-ink lg:h-8 lg:text-[13.5px]"
          value={stationId}
          data-testid="station-picker"
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith("spot:")) onSpot(v.slice(5));
            else onStation(v);
          }}
        >
          <optgroup label="Tide stations">
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </optgroup>
          {spots.length ? (
            <optgroup label="Shoreline spots">
              {spots.map((s) => (
                <option key={s.slug} value={`spot:${s.slug}`}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </label>
      <DateRange from={from} onShiftWeek={onShiftWeek} onNow={onNow} onNextKing={onNextKing} className="hidden lg:flex" />
      <nav className="ml-auto hidden items-center gap-3 text-[13.5px] lg:flex" aria-label="Pages">
        <Link className="hover:text-link" href="/king-tides">
          King tide calendar
        </Link>
        <Link className="hover:text-link" href="/stations">
          Stations
        </Link>
        <Link className="hover:text-link" href="/spots">
          Spots
        </Link>
        <Link className="hover:text-link" href="/methodology">
          Methodology
        </Link>
      </nav>
      <button type="button" onClick={share} className="flex h-11 shrink-0 items-center rounded border border-line bg-panel px-3 text-[14px] text-ink hover:border-ink lg:h-8 lg:px-2.5 lg:text-[13.5px]" data-testid="share">
        {copied ? "Copied" : "Share"}
      </button>
    </header>
  );
}
