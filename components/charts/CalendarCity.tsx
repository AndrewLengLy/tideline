"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { CITY } from "@/lib/colors";
import { fmtShortDay } from "@/lib/format";
import { crossesLine, lineWords } from "@/lib/metrics/days-over";
import { dayStart, HOUR } from "@/lib/time";
import { blockHeight, blockOutline, blockTop, cell, cityLayout, cityPaths, dayOf, hitTest, monthMarks } from "./calendar-city";

interface Props {
  dailyMax: (number | null)[];
  dailyStart: string;
  /** Average high tide in feet above average low tide. */
  mhhw: number;
  line: { kind: "minor" | "action"; ft: number };
  /** The water slider's added height in feet. */
  addFt: number;
  stationName: string;
  height: number;
  initialWidth?: number;
}

/** Words for one day: its date, its highest tide, and where that lands against the line. */
export function dayWords(v: number, day: string, addFt: number, mhhw: number, line: Props["line"]): { date: string; high: string; vs: string } {
  const words = lineWords(line.kind);
  const date = fmtShortDay(dayStart(day) + 12 * HOUR);
  const high = addFt > 0 ? `Highest tide ${v.toFixed(1)} ft, or ${(v + addFt).toFixed(1)} ft with ${addFt} ft of rise` : `Highest tide ${v.toFixed(1)} ft`;
  const over = crossesLine(v, addFt, mhhw, line.ft);
  const gap = Math.abs(v + addFt - mhhw - line.ft).toFixed(1);
  const vs = over ? (gap === "0.0" ? `Just over the ${words}` : `${gap} ft over the ${words}`) : gap === "0.0" ? `At the ${words}` : `${gap} ft under the ${words}`;
  return { date, high, vs };
}

/**
 * Twelve months of days as small blocks. A block's height is that day's highest tide above an
 * average high tide plus the slider. Days that reach the line turn coral on a coral base tile.
 */
export function CalendarCity({ dailyMax, dailyStart, mhhw, line, addFt: liveAdd, stationName, height, initialWidth = 420 }: Props) {
  // The slider answers first. The city redraws in its own render right after, so a drag never waits on 365 blocks.
  const addFt = useDeferredValue(liveAdd);
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(initialWidth);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(160, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const input = useMemo(() => ({ max: dailyMax, start: dailyStart, mhhw, lineFt: line.ft, w, h: height }), [dailyMax, dailyStart, mhhw, line.ft, w, height]);
  const L = useMemo(() => cityLayout(input), [input]);
  const paths = useMemo(() => cityPaths(L, input, addFt), [L, input, addFt]);
  const marks = useMemo(() => monthMarks(L, dailyStart, dailyMax.length), [L, dailyStart, dailyMax.length]);
  const words = lineWords(line.kind);

  const activeV = active !== null ? dailyMax[active] : null;
  const tip = active !== null && activeV !== null && activeV !== undefined ? dayWords(activeV, dayOf(dailyStart, active), addFt, mhhw, line) : null;
  const activeH = activeV !== null && activeV !== undefined ? blockHeight(L, activeV, mhhw, addFt) : 0;
  const tipAt = active !== null && tip ? blockTop(L, active, activeH) : null;

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    setActive(hitTest(L, input, addFt, e.clientX - box.left, e.clientY - box.top));
  };

  const onKey = (e: React.KeyboardEvent<SVGSVGElement>) => {
    const n = dailyMax.length;
    const step: Record<string, number> = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 };
    if (e.key in step) {
      e.preventDefault();
      setActive((a) => Math.max(0, Math.min(n - 1, (a ?? 0) + step[e.key])));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(n - 1);
    } else if (e.key === "Escape") {
      setActive(null);
    }
  };

  const label = `${stationName}: ${paths.count} of the next ${dailyMax.length} days reach the ${words} with ${addFt} ft of sea level rise. Arrow keys step through the days.`;

  return (
    <div className="min-w-0">
      <p className="text-[20px] leading-tight" data-testid="city-count">
        <span className="num font-medium">{paths.count}</span> {paths.count === 1 ? "day reaches" : "days reach"} the {words}
      </p>
      <div ref={ref} className="relative" style={{ height }}>
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${w} ${height}`}
          role="img"
          aria-label={label}
          tabIndex={0}
          className="block touch-none overflow-visible outline-offset-2"
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setActive(null);
          }}
          onKeyDown={onKey}
          onFocus={() => setActive((a) => a ?? 0)}
          onBlur={() => setActive(null)}
          data-testid="calendar-city"
          data-add={addFt}
        >
          {marks.map((m) => (
            <text key={`${m.x}-${m.label}`} x={m.x} y={9} fontSize={10} fill="#46606f" className="num">
              {m.label}
            </text>
          ))}
          {paths.rows.map((row, r) => (
            <g key={r}>
              {row.empty ? <path d={row.empty} fill={CITY.empty} /> : null}
              {row.base ? <path d={row.base} fill={CITY.base} fillOpacity={0.5} /> : null}
              <path d={row.dry.side} fill={CITY.drySide} />
              <path d={row.dry.front} fill={CITY.dryFront} />
              <path d={row.dry.top} fill={CITY.dryTop} />
              <path d={row.wet.side} fill={CITY.wetSide} />
              <path d={row.wet.front} fill={CITY.wetFront} />
              <path d={row.wet.top} fill={CITY.wetTop} />
            </g>
          ))}
          {active !== null && activeV !== null && activeV !== undefined ? (
            <path d={blockOutline(L, cell(L, active).c, cell(L, active).r, activeH)} fill="none" stroke="#0d2230" strokeWidth={1.25} strokeLinejoin="round" />
          ) : null}
        </svg>
        {tip && tipAt ? (
          <div
            className="panel pointer-events-none absolute z-10 w-max max-w-[220px] px-2 py-1 text-[12px] leading-snug"
            style={{ left: Math.min(Math.max(tipAt[0], 70), w - 70), top: tipAt[1] - 6, translate: "-50% -100%" }}
            data-testid="city-tip"
          >
            <p className="font-bold">{tip.date}</p>
            <p className="num">{tip.high}</p>
            <p className={crossesLine(activeV!, addFt, mhhw, line.ft) ? "text-coral-ink" : "text-muted"}>{tip.vs}</p>
          </div>
        ) : null}
        <p className="sr-only" aria-live="polite">
          {tip ? `${tip.date}. ${tip.high}. ${tip.vs}.` : ""}
        </p>
      </div>
    </div>
  );
}
