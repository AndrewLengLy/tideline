"use client";

import { useMemo, useRef } from "react";
import { scaleLinear } from "d3-scale";
import { area, curveMonotoneX } from "d3-shape";
import { fmtDateTime, fmtShortDay } from "@/lib/format";
import { addDays, dayStart, pacificDay } from "@/lib/time";
import { type Playhead, type Speed, usePlayheadIndex } from "./playhead";

export interface ScrubberEvent {
  index: number;
  kind: "king" | "threshold";
  label: string;
}

interface Props {
  playhead: Playhead;
  t0: number;
  stepMs: number;
  count: number;
  series: Float32Array | null;
  playing: boolean;
  onPlaying: (p: boolean) => void;
  speed: Speed;
  onSpeed: (s: Speed) => void;
  nowIndex: number;
  /** Share of frames that have arrived, from 0 to 1. */
  loaded: number;
  events: ScrubberEvent[];
  readout?: (index: number) => string;
  className?: string;
  onScrub?: () => void;
}

const SPEEDS: Speed[] = [1, 4, 16];

/** Shared timeline scrubber: play, speed, drag, arrow keys, a now marker, and event marks on the track. */
export function Scrubber(props: Props) {
  const { playhead, t0, stepMs, count, series, playing, onPlaying, speed, onSpeed, nowIndex, loaded, events } = props;
  const track = useRef<HTMLDivElement>(null);
  const index = usePlayheadIndex(playhead);
  const pct = count > 1 ? (Math.min(index, count - 1) / (count - 1)) * 100 : 0;
  const t = t0 + index * stepMs;
  const isNow = Math.abs(index - nowIndex) <= 1;
  const readout = props.readout?.(Math.min(index, count - 1)) ?? "";

  const path = useMemo(() => {
    if (!series || count < 2) return "";
    let min = Infinity;
    let max = -Infinity;
    for (const v of series) {
      if (Number.isNaN(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (!Number.isFinite(min)) return "";
    const x = scaleLinear().domain([0, count - 1]).range([0, 1000]);
    const y = scaleLinear().domain([min - 0.5, max]).range([30, 2]);
    const every = 3;
    const pts: [number, number][] = [];
    for (let i = 0; i < count; i += every) if (!Number.isNaN(series[i])) pts.push([x(i), y(series[i])]);
    return area<[number, number]>().x((d) => d[0]).y0(30).y1((d) => d[1]).curve(curveMonotoneX)(pts) ?? "";
  }, [series, count]);

  const days = useMemo(() => {
    const out: { pct: number; label: string; day: string }[] = [];
    let d = pacificDay(t0);
    for (let k = 0; k < 8; k++) {
      const ms = dayStart(d);
      const i = (ms - t0) / stepMs;
      if (i >= 0 && i < count) out.push({ pct: (i / Math.max(1, count - 1)) * 100, label: fmtShortDay(ms + 12 * 3_600_000).replace(/,.*/, ""), day: d.slice(8).replace(/^0/, "") });
      d = addDays(d, 1);
    }
    return out;
  }, [t0, stepMs, count]);

  const fromPointer = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || count < 2) return;
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    playhead.set(Math.round(f * (count - 1)));
    props.onScrub?.();
  };

  const stepBy = (n: number) => {
    onPlaying(false);
    playhead.set(Math.max(0, Math.min(count - 1, index + n)));
    props.onScrub?.();
  };

  const onKey = (e: React.KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 };
    if (e.key in steps) {
      e.preventDefault();
      stepBy(steps[e.key]);
    } else if (e.key === "Home") {
      e.preventDefault();
      stepBy(-index);
    } else if (e.key === "End") {
      e.preventDefault();
      stepBy(count - 1 - index);
    } else if (e.key === " ") {
      e.preventDefault();
      onPlaying(!playing);
    }
  };

  return (
    <div className={`flex items-center gap-2 md:gap-3 ${props.className ?? ""}`}>
      <button
        type="button"
        onClick={() => {
          if (!playing && index >= count - 1) playhead.set(0);
          onPlaying(!playing);
        }}
        disabled={count < 2}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-line bg-panel text-ink hover:border-ink disabled:opacity-40"
        aria-label={playing ? "Pause tide playback" : "Play tide playback"}
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <rect x="2" y="1" width="3.5" height="12" fill="currentColor" />
            <rect x="8.5" y="1" width="3.5" height="12" fill="currentColor" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path d="M3 1.5v11l9-5.5z" fill="currentColor" />
          </svg>
        )}
      </button>
      <div className="flex shrink-0 overflow-hidden rounded border border-line bg-panel" role="group" aria-label="Playback speed">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSpeed(s)}
            aria-pressed={speed === s}
            className={`num h-11 w-11 text-[13px] lg:w-9 ${speed === s ? "bg-ink text-panel" : "text-muted hover:text-ink"}`}
          >
            {s}x
          </button>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-baseline justify-between gap-2 text-[12px]">
          <span className="num truncate text-ink" data-testid="scrub-time">
            {fmtDateTime(t)}
            {isNow ? <span className="ml-1.5 text-water">now</span> : null}
          </span>
          {readout ? <span className="num hidden shrink-0 text-muted sm:inline">{readout}</span> : null}
        </div>
        <div
          ref={track}
          role="slider"
          tabIndex={0}
          aria-label="Scrubber time"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, count - 1)}
          aria-valuenow={Math.min(index, count - 1)}
          aria-valuetext={`${fmtDateTime(t)}${readout ? `, ${readout}` : ""}${isNow ? ", now" : ""}`}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            onPlaying(false);
            fromPointer(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.buttons) fromPointer(e.clientX);
          }}
          className="relative h-[44px] cursor-pointer touch-none select-none"
        >
          <svg viewBox="0 0 1000 30" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-[30px] w-full" aria-hidden>
            <path d={path} fill="#0077b6" fillOpacity={0.16} stroke="#0077b6" strokeOpacity={0.55} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="absolute inset-x-0 top-[30px] h-px bg-ink/40" aria-hidden />
          {loaded < 1 ? (
            <div className="absolute left-0 top-[29px] h-[3px] bg-water transition-[width] duration-200 ease-out" style={{ width: `${Math.max(4, loaded * 100)}%` }} data-testid="scrub-progress" aria-hidden />
          ) : null}
          {days.map((d) => (
            <div key={d.pct} className="absolute top-[30px] h-[14px] border-l border-line pl-1 text-[10.5px] leading-[14px] text-muted" style={{ left: `${d.pct}%` }} aria-hidden>
              <span className="num">
                <span className="hidden sm:inline">{d.label} </span>
                {d.day}
              </span>
            </div>
          ))}
          {events.map((e) => (
            <div
              key={`${e.kind}-${e.index}`}
              className="absolute top-[22px]"
              style={{ left: `${(e.index / Math.max(1, count - 1)) * 100}%` }}
              title={e.label}
              data-testid={`event-${e.kind}`}
              aria-hidden
            >
              {e.kind === "king" ? (
                <svg width="11" height="9" viewBox="0 0 11 9" className="-ml-[5.5px]">
                  <path d="M5.5 0 11 9H0z" fill="#e76f51" stroke="#0d2230" strokeWidth="0.75" />
                </svg>
              ) : (
                <div className="-ml-px mt-1 h-[5px] w-0.5 bg-coral" />
              )}
            </div>
          ))}
          {nowIndex >= 0 && nowIndex < count ? (
            <div className="absolute top-0 h-[30px] w-px bg-ink/70" style={{ left: `${(nowIndex / Math.max(1, count - 1)) * 100}%` }} data-testid="now-marker" aria-hidden>
              <span className="num absolute -top-px left-1 text-[10px] leading-3 text-ink">now</span>
            </div>
          ) : null}
          <div className="absolute top-0 h-[34px] w-0.5 bg-ink" style={{ left: `calc(${pct}% - 1px)` }} aria-hidden>
            <div className="absolute -left-[6px] top-[26px] h-3.5 w-3.5 rounded-full border-2 border-panel bg-ink" />
          </div>
        </div>
      </div>
    </div>
  );
}
