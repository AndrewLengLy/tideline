"use client";

import type { LayerId, LayerSettings } from "../map/layers";

const SWATCH: Record<LayerId, React.ReactNode> = {
  terrain: (
    <svg viewBox="0 0 34 34" className="h-full w-full" aria-hidden>
      <rect width="34" height="34" fill="#d9d1c0" />
      <path d="M0 26 9 12l6 8 5-11 14 17v8H0z" fill="#8c8069" />
      <path d="m9 12 3 8-5 6zm11-3 3 12-5 5z" fill="#6e6452" />
    </svg>
  ),
  imagery: (
    <svg viewBox="0 0 34 34" className="h-full w-full" aria-hidden>
      <rect width="34" height="34" fill="#a69d7f" />
      <path d="M0 0h20L8 34H0z" fill="#7d8a61" />
      <path d="M22 0h12v14z" fill="#8fb4c4" />
      <path d="M14 34 24 12l10 8v14z" fill="#c4b99c" />
    </svg>
  ),
  slr: (
    <svg viewBox="0 0 34 34" className="h-full w-full" aria-hidden>
      <rect width="34" height="34" fill="#e8e4dc" />
      <path d="M0 18c6-5 11 3 17-1s11-4 17 0v17H0z" fill="#46aadb" />
      <path d="M0 26c6-4 11 2 17-1s11-3 17 0v9H0z" fill="#0a5587" />
    </svg>
  ),
  confidence: (
    <svg viewBox="0 0 34 34" className="h-full w-full" aria-hidden>
      <rect width="34" height="34" fill="#eef3f5" />
      {[-8, 0, 8, 16, 24, 32, 40].map((x) => (
        <path key={x} d={`M${x} 34 ${x + 34} 0`} stroke="#0d2230" strokeWidth="2" />
      ))}
    </svg>
  ),
  thresholds: (
    <svg viewBox="0 0 34 34" className="h-full w-full" aria-hidden>
      <rect width="34" height="34" fill="#eef3f5" />
      <rect x="6" y="14" width="8" height="20" fill="#0077b6" />
      <rect x="20" y="6" width="8" height="28" fill="#e76f51" />
      <path d="M0 13h34" stroke="#0d2230" strokeWidth="1.2" />
    </svg>
  ),
  buildings: (
    <svg viewBox="0 0 34 34" className="h-full w-full" aria-hidden>
      <rect width="34" height="34" fill="#dfe5e8" />
      <path d="M5 34V16h9v18zM17 34V7h11v27z" fill="#e6e1d8" stroke="#8a948f" />
    </svg>
  ),
  spots: (
    <svg viewBox="0 0 34 34" className="h-full w-full" aria-hidden>
      <rect width="34" height="34" fill="#eef3f5" />
      <rect x="6" y="5" width="22" height="10" rx="2" fill="#f8fafb" stroke="#0d2230" />
      <path d="M17 15v12" stroke="#0d2230" />
      <circle cx="17" cy="28" r="2.5" fill="#f8fafb" stroke="#0d2230" />
    </svg>
  ),
};

const ROWS: { id: LayerId; name: string; source: string; opacityName: string }[] = [
  { id: "terrain", name: "Terrain (3D)", source: "AWS Terrain Tiles (Mapzen)", opacityName: "hillshade" },
  { id: "imagery", name: "Aerial imagery", source: "USGS National Map imagery", opacityName: "aerial imagery" },
  { id: "slr", name: "Sea level rise", source: "NOAA SLR Viewer, slr_{N}ft", opacityName: "sea level rise" },
  { id: "confidence", name: "Mapping confidence", source: "NOAA SLR Viewer, conf_{N}ft", opacityName: "mapping confidence" },
  { id: "thresholds", name: "Flood thresholds", source: "NOAA CO-OPS gauges", opacityName: "gauge columns" },
  { id: "buildings", name: "Buildings", source: "OpenFreeMap, OpenStreetMap", opacityName: "buildings" },
  { id: "spots", name: "Shoreline spots", source: "Tideline, from public sources", opacityName: "shoreline spots" },
];

/** Layers most visitors never touch fold under More layers. */
const MORE = new Set<LayerId>(["terrain", "buildings", "confidence"]);

interface Props {
  layers: LayerSettings;
  onChange: (id: LayerId, next: { on: boolean; opacity: number }) => void;
  followTide: boolean;
  onFollowTide: (on: boolean) => void;
}

/** Every layer gets a thumbnail swatch, a checkbox, and an opacity slider with its percent, and shows its source. */
export function LayerRows({ layers, onChange, followTide, onFollowTide }: Props) {
  const row = (r: (typeof ROWS)[number]) => {
    const s = layers[r.id];
    const inputId = `layer-${r.id}`;
    return (
      <li key={r.id} className="flex items-center gap-2 py-1.5">
        <label htmlFor={inputId} className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 lg:min-h-9">
          <input id={inputId} type="checkbox" checked={s.on} onChange={(e) => onChange(r.id, { ...s, on: e.target.checked })} className="h-4 w-4 shrink-0 accent-[#0d2230]" />
          <span className="h-[34px] w-[34px] shrink-0 overflow-hidden rounded border border-line">{SWATCH[r.id]}</span>
          <span className="min-w-0">
            <span className="block truncate font-bold leading-tight">{r.name}</span>
            <span className="block truncate text-[11.5px] leading-tight text-muted">{r.source}</span>
          </span>
        </label>
        <div className="flex w-[92px] shrink-0 items-center gap-1">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(s.opacity * 100)}
            disabled={!s.on}
            onChange={(e) => onChange(r.id, { ...s, opacity: Number(e.target.value) / 100 })}
            className="mini-range w-[56px] disabled:opacity-40"
            aria-label={`Opacity of ${r.opacityName}`}
          />
          <span className="num w-[32px] text-right text-[11.5px] text-muted">{Math.round(s.opacity * 100)}%</span>
        </div>
      </li>
    );
  };
  return (
    <div className="text-[13px]">
      <ul className="divide-y divide-line">{ROWS.filter((r) => !MORE.has(r.id)).map(row)}</ul>
      <details className="mt-1 border-t border-line pt-1">
        <summary className="flex min-h-11 cursor-pointer items-center font-bold lg:min-h-9">More layers</summary>
        <ul className="divide-y divide-line">{ROWS.filter((r) => MORE.has(r.id)).map(row)}</ul>
      </details>
      <label className="mt-2 flex min-h-11 cursor-pointer items-start gap-2 border-t border-line pt-2 lg:min-h-0">
        <input type="checkbox" checked={followTide} onChange={(e) => onFollowTide(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#0d2230]" />
        <span>Add the scrubber tide to the water layer. Water over the high-tide line at the selected gauge raises the layer, and the shoreline moves with it.</span>
      </label>
      <div className="mt-3 space-y-1.5 border-t border-line pt-2 text-[12.5px] leading-snug">
        <p>
          Water layer: NOAA screening-level maps from a modified bathtub method that accounts for tidal variation and hydrologic connectivity. The high-tide line means MHHW, the average height of the higher high tide each day.
        </p>
        <p className="flex items-start gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" className="mt-0.5 shrink-0" aria-hidden>
            <rect width="16" height="16" fill="#8a9a8f" />
            <path d="M0 0h9v16H0z" fill="#46aadb" />
            <path d="M9.5 0v16" stroke="#0d2230" strokeWidth="1.2" />
            <path d="M8 0v16" stroke="#f2fbff" strokeWidth="2" />
          </svg>
          <span>Bright line: the waterline at the current level, edged in dark on the dry side. At 0 ft it is today&apos;s high-tide line.</span>
        </p>
        <p className="flex items-start gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" className="mt-0.5 shrink-0" aria-hidden>
            <rect width="16" height="16" fill="#46aadb" />
            <path d="M5 0v16" stroke="#f2fbff" strokeWidth="1.4" strokeDasharray="3 3" />
          </svg>
          <span>Blue: land that goes under only with the added water. Darker blue is deeper. The dashed line inside it is today&apos;s high-tide line.</span>
        </p>
        <p className="flex items-start gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" className="mt-0.5 shrink-0" aria-hidden>
            <rect width="16" height="16" fill="#c4dfec" opacity="0.6" />
          </svg>
          <span>Pale tint: marsh and ponds that are already wet at today&apos;s high tide.</span>
        </p>
        <p className="flex items-start gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" className="mt-0.5 shrink-0" aria-hidden>
            <rect width="16" height="16" fill="#e6ecee" />
            {[2, 7, 12].flatMap((x) => [2, 7, 12].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="1.6" height="1.6" fill="#46606f" />))}
          </svg>
          <span>Dot grid: land below the water level with no path to the Bay. NOAA calls these low-lying areas.</span>
        </p>
        <p className="flex items-start gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" className="mt-0.5 shrink-0" aria-hidden>
            <rect width="16" height="16" fill="#e6ecee" />
            {[-4, 2, 8, 14].map((x) => (
              <path key={x} d={`M${x} 16 ${x + 16} 0`} stroke="#0d2230" strokeWidth="1.2" />
            ))}
          </svg>
          <span>Hatch: low mapping confidence. The cell could be wet or dry.</span>
        </p>
        <p className="flex items-start gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" className="mt-0.5 shrink-0" aria-hidden>
            <path d="M0 9C3 2 5 2 8 9s5 7 8 0" fill="none" stroke="#0077b6" strokeWidth="1.2" />
            <circle cx="4" cy="4" r="2" fill="#e76f51" stroke="#0d2230" />
            <circle cx="12" cy="13" r="1.6" fill="#f8fafb" stroke="#0d2230" />
          </svg>
          <span>Timeline: dark dots mark high tides and rings mark low tides. The highest high and lowest low in view are larger and labeled. Near a turn, the time line names it.</span>
        </p>
        <p className="flex items-start gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" className="mt-0.5 shrink-0" aria-hidden>
            <rect x="2" y="4" width="4" height="12" fill="#0077b6" />
            <path d="M0 8h8M1 11h6M1 14h6" stroke="#0d2230" strokeWidth="0.8" />
            <path d="M0 6h16" stroke="#0d2230" strokeWidth="1.6" />
            <circle cx="12" cy="1.6" r="1.3" fill="#0d2230" />
            <path d="M10.6 3.4h2.8v4.4h-.8V6h-.4v1.8h-1.6z" fill="#0d2230" />
          </svg>
          <span>Staffs: water level at each gauge at the scrubber time, plus the slider, with a tick every foot. The thick ring is the high-tide line and the coral ring is the minor flood threshold. A 6 ft person stands on the high-tide line, so water over it shows as depth on a body. Heights are drawn for legibility, and the label prints the true value.</span>
        </p>
      </div>
    </div>
  );
}
