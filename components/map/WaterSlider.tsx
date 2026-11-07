"use client";

import { signedFt } from "@/lib/format";
import { STEP_COLORS, stepColor } from "@/lib/colors";
import type { MapPlace } from "@/lib/types";

interface Props {
  value: number;
  onChange: (ft: number) => void;
  /** Step drawn on the map, which can sit above the slider when the scrubber tide is added. */
  effective: number;
  tideAddFt: number;
  kingEq: number | null;
  kingLabel: string;
  placesByFt: Map<number, MapPlace[]>;
  compare: boolean;
  onCompare: (on: boolean) => void;
  canCompare: boolean;
}

const TICKS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

/** The signature control. A native range input, so arrow keys and screen readers work without extra code. */
export function WaterSlider({ value, onChange, effective, tideAddFt, kingEq, kingLabel, placesByFt, compare, onCompare, canCompare }: Props) {
  const here = placesByFt.get(effective) ?? [];
  return (
    <div className="flex items-start gap-2">
      <div className="panel flex w-[74px] flex-col items-stretch px-1.5 pb-2 pt-1.5 md:w-[92px]">
        <p className="text-center text-[12px] leading-tight text-muted">Sea level rise</p>
        <p className="num mt-0.5 flex items-center justify-center gap-1 text-[17px] font-medium leading-none md:text-[19px]" data-testid="water-value">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: stepColor(value) }} aria-hidden />
          {value} ft
        </p>
        <div className="relative mt-2 h-[230px] md:h-[310px]">
          <div className="absolute inset-y-[11px] left-[20px] w-[6px] overflow-hidden rounded-sm" aria-hidden>
            {TICKS.map((t) => (
              <div key={t} style={{ background: STEP_COLORS[t], height: `${100 / 11}%` }} />
            ))}
          </div>
          <div className="absolute inset-y-[11px] left-[46px] right-0" aria-hidden>
            {TICKS.map((t) => (
              <span
                key={t}
                className={`num absolute left-0 -translate-y-1/2 text-[11px] leading-none ${t === value ? "font-medium text-ink" : "text-muted"}`}
                style={{ bottom: `calc(${t * 10}% - 5.5px)` }}
              >
                {t}
              </span>
            ))}
          </div>
          {kingEq !== null ? (
            <div
              className="absolute left-0 flex -translate-y-1/2 items-center"
              style={{ top: `calc(11px + (100% - 22px) * ${1 - Math.min(10, kingEq) / 10})` }}
              data-testid="king-marker"
              title={kingLabel}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                <path d="M0 0 12 6 0 12z" fill="#e76f51" stroke="#0d2230" strokeWidth="0.75" />
              </svg>
            </div>
          ) : null}
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="water-range absolute left-[1px] top-0"
            aria-label="Sea level rise in feet above today's MHHW"
            aria-valuetext={`${value} feet of sea level rise`}
          />
        </div>
        {kingEq !== null ? (
          <p className="mt-1 text-center text-[11px] leading-tight text-muted">
            <span className="text-coral-ink" aria-hidden>
              ▸
            </span>{" "}
            next king tide <span className="num">{kingEq.toFixed(1)} ft</span>
          </p>
        ) : null}
        {canCompare ? (
          <button
            type="button"
            onClick={() => onCompare(!compare)}
            aria-pressed={compare}
            className={`mt-1.5 h-11 rounded border text-[12px] leading-tight md:h-8 ${compare ? "border-ink bg-ink text-panel" : "border-line bg-panel text-ink hover:border-ink"}`}
          >
            Compare
          </button>
        ) : null}
      </div>
      {effective > 0 || tideAddFt > 0 ? (
        <div className="panel hidden max-w-[210px] px-2.5 py-1.5 text-[12.5px] leading-snug md:block" data-testid="water-places">
          <p className="num font-medium">{effective} ft on the map</p>
          {tideAddFt > 0 ? (
            <p className="text-muted">
              {value} ft slider plus {signedFt(tideAddFt)} tide
            </p>
          ) : null}
          {here.length ? (
            <p className="mt-1">
              First under at this step: {here.slice(0, 3).map((p) => p.name).join(", ")}
              {here.length > 3 ? `, and ${here.length - 3} more` : ""}.
            </p>
          ) : (
            <p className="mt-1 text-muted">No listed place first floods at this step.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
