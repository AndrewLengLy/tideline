"use client";

import { memo } from "react";
import { stepColor } from "@/lib/colors";
import type { Slab } from "../map/stack";

/**
 * The exploded view as a flat legend, for phones and browsers with no WebGL2: the same slabs and
 * the same lines, stacked top slab first.
 */
export const StackLegend = memo(function StackLegend({ slabs, stationName }: { slabs: Slab[]; stationName: string }) {
  const top = [...slabs].reverse();
  return (
    <section aria-labelledby="stack-legend-title" data-testid="stack-legend">
      <h3 id="stack-legend-title" className="text-[13px] font-bold">
        Water layers at {stationName}
      </h3>
      <ol className="mt-1.5 space-y-1.5">
        {top.map((s, i) => (
          <li key={s.kind} className="flex items-start gap-2 text-[13px] leading-snug" data-kind={s.kind}>
            <svg width="30" height={18} viewBox="0 0 30 18" className="mt-0.5 shrink-0" aria-hidden>
              {/* A slab seen from above and in front. Lower slabs shift down so the rows read as a stack. */}
              <path d={`M6 ${4 + i} L28 ${4 + i} L24 ${12 + i} L2 ${12 + i} Z`} fill={stepColor(s.ft)} fillOpacity={0.85} stroke={s.kind === "merged" ? "#e76f51" : "#0d2230"} strokeWidth={s.kind === "merged" ? 1.75 : 0.75} />
            </svg>
            <span>{s.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
})
