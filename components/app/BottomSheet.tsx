"use client";

import { useEffect, useRef, useState } from "react";

export type Snap = 0 | 1 | 2;
const SNAP_LABEL = ["Show details", "Expand details", "Collapse details"];

export const PEEK_HEIGHT = 128;
/** Height left at the top for the bar and the scrubber when the sheet is fully open. */
const FULL_GAP = 52 + 82;

/** Phone bottom sheet with three snap points: peek, half, and full. Reports its height so the scrubber can ride above it. */
export function BottomSheet({
  peek,
  children,
  snap,
  onSnap,
  onHeight,
  className = "",
}: {
  peek: React.ReactNode;
  children: React.ReactNode;
  snap: Snap;
  onSnap: (s: Snap) => void;
  onHeight: (h: number) => void;
  className?: string;
}) {
  const [vh, setVh] = useState(812);
  const drag = useRef<{ y: number; h: number } | null>(null);
  const [dragH, setDragH] = useState<number | null>(null);

  useEffect(() => {
    const set = () => setVh(window.innerHeight);
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, []);

  const heights = [PEEK_HEIGHT, Math.round(vh * 0.5), Math.max(Math.round(vh * 0.5), vh - FULL_GAP)];
  const h = dragH ?? heights[snap];

  useEffect(() => onHeight(h), [h, onHeight]);

  return (
    <section
      className={`absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-lg border-x border-t border-line bg-panel ${dragH === null ? "transition-[height] duration-[250ms] ease-out" : ""} ${className}`}
      style={{ height: h }}
      aria-label="Details"
      data-testid="bottom-sheet"
      data-snap={snap}
    >
      <button
        type="button"
        aria-label={SNAP_LABEL[snap]}
        className="flex h-11 w-full shrink-0 touch-none items-center justify-center"
        onClick={() => onSnap(((snap + 1) % 3) as Snap)}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          drag.current = { y: e.clientY, h };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dy = drag.current.y - e.clientY;
          if (Math.abs(dy) > 6) setDragH(Math.max(heights[0], Math.min(heights[2], drag.current.h + dy)));
        }}
        onPointerUp={() => {
          if (dragH !== null) {
            const nearest = heights.reduce((best, v, i) => (Math.abs(v - dragH) < Math.abs(heights[best] - dragH) ? i : best), 0) as Snap;
            onSnap(nearest);
          }
          drag.current = null;
          setDragH(null);
        }}
      >
        <span className="h-1 w-10 rounded bg-line" aria-hidden />
      </button>
      <div className="shrink-0 px-3">{peek}</div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}
