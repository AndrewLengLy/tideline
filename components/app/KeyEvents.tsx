"use client";

import { fmtShortDay, fmtTime } from "@/lib/format";
import { pacificDay } from "@/lib/time";

export type KeyEventKind = "high" | "king" | "threshold" | "surge";

export interface KeyEvent {
  index: number;
  at: number;
  kind: KeyEventKind;
  label: string;
}

/**
 * Key moments in the week the scrubber covers: each day's highest predicted high, king tides,
 * minor threshold crossings, and the largest observed surge. A king tide replaces that day's high.
 */
export function deriveKeyEvents(opts: {
  t0: number;
  stepMs: number;
  predicted: Float32Array | null;
  kings: KeyEvent[];
  crossings: KeyEvent[];
  surge: { at: number; maxFt: number } | null;
}): KeyEvent[] {
  const { t0, stepMs, predicted, kings, crossings, surge } = opts;
  const out: KeyEvent[] = [...kings, ...crossings];
  const kingDays = new Set(kings.map((k) => pacificDay(k.at)));
  if (predicted && predicted.length) {
    let day = "";
    let best = -1;
    const flush = () => {
      if (best >= 0 && !kingDays.has(day)) {
        out.push({ index: best, at: t0 + best * stepMs, kind: "high", label: `High ${predicted[best].toFixed(1)} ft MLLW` });
      }
    };
    for (let i = 0; i < predicted.length; i++) {
      const d = pacificDay(t0 + i * stepMs);
      if (d !== day) {
        flush();
        day = d;
        best = i;
      } else if (predicted[i] > predicted[best]) {
        best = i;
      }
    }
    flush();
  }
  if (surge && surge.maxFt > 0) {
    const i = Math.round((surge.at - t0) / stepMs);
    if (i >= 0 && (!predicted || i < predicted.length)) {
      out.push({ index: i, at: surge.at, kind: "surge", label: `Largest surge +${surge.maxFt.toFixed(2)} ft` });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

const DOT: Record<KeyEventKind, string> = {
  high: "bg-water",
  king: "bg-coral",
  threshold: "bg-ink",
  surge: "bg-muted",
};

export function KeyEvents({ events, onPick, activeIndex }: { events: KeyEvent[]; onPick: (index: number) => void; activeIndex: number | null }) {
  if (!events.length) return null;
  return (
    <section aria-labelledby="key-events-title" data-testid="key-events">
      <h3 id="key-events-title" className="text-[13px] font-bold">
        Key events this week
      </h3>
      <ol className="mt-1.5 divide-y divide-line rounded border border-line">
        {events.map((e) => (
          <li key={`${e.kind}-${e.index}`}>
            <button
              type="button"
              onClick={() => onPick(e.index)}
              className={`flex min-h-10 w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12.5px] hover:bg-sunk ${activeIndex === e.index ? "bg-sunk" : ""}`}
            >
              <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT[e.kind]}`} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{e.label}</span>
              <span className="num shrink-0 text-[11.5px] text-muted">
                {fmtShortDay(e.at)} {fmtTime(e.at)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
