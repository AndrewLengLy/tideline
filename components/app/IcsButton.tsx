"use client";

import { buildIcs, icsFileName } from "@/lib/metrics/ics";
import type { KingTide } from "@/lib/types";

/** Builds the calendar file in the browser. The event starts 30 minutes before the peak. */
export function IcsButton({ tide, className = "" }: { tide: KingTide; className?: string }) {
  const onClick = () => {
    const blob = new Blob([buildIcs(tide, Date.now())], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = icsFileName(tide);
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 items-center rounded border border-line bg-panel px-2.5 text-[13px] text-ink hover:border-ink lg:h-8 ${className}`}
      aria-label={`Add the ${tide.stationName} king tide on ${new Date(tide.t).toISOString().slice(0, 10)} to a calendar`}
    >
      .ics
    </button>
  );
}
