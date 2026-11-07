"use client";

import { useState } from "react";
import type { KingTide, Station } from "@/lib/types";
import { TideTable } from "./TideTable";

const ALL = "all";

/** The Bay-wide list, with a picker that swaps in any one station's 20 highest tides. */
export function CalendarTable({ calendar, perStation, stations }: { calendar: KingTide[]; perStation: Record<string, KingTide[]>; stations: Station[] }) {
  const [pick, setPick] = useState(ALL);
  const rows = pick === ALL ? calendar : [...(perStation[pick] ?? [])].sort((a, b) => a.t - b.t);
  return (
    <div>
      <label className="mb-3 flex flex-wrap items-center gap-2 text-[15px]">
        Show
        <select className="h-11 rounded border border-line bg-panel px-2 text-[15px]" value={pick} onChange={(e) => setPick(e.target.value)} data-testid="calendar-picker">
          <option value={ALL}>All Bay stations</option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <TideTable tides={rows} showStation={pick === ALL} />
    </div>
  );
}
