"use client";

interface Props {
  is3D: boolean;
  on3D: (on: boolean) => void;
  exaggeration: number;
  onExaggeration: (x: number) => void;
  bearing: number;
  onResetBearing: () => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
  webgl2: boolean;
}

const BTN = "flex h-11 min-w-11 items-center justify-center bg-panel text-ink hover:bg-sunk md:h-9 md:min-w-9";

/** Bottom-right cluster: 2D or 3D, terrain exaggeration, compass, and fullscreen. */
export function MapControls({ is3D, on3D, exaggeration, onExaggeration, bearing, onResetBearing, onFullscreen, isFullscreen, webgl2 }: Props) {
  return (
    <div className="pointer-events-auto flex items-center gap-1.5">
      {webgl2 ? (
        <div className="flex overflow-hidden rounded border border-line" role="group" aria-label="Map dimension">
          <button type="button" className={`${BTN} num text-[13px] ${!is3D ? "!bg-ink !text-panel" : ""}`} onClick={() => on3D(false)} aria-pressed={!is3D}>
            2D
          </button>
          <button type="button" className={`${BTN} num text-[13px] ${is3D ? "!bg-ink !text-panel" : ""}`} onClick={() => on3D(true)} aria-pressed={is3D}>
            3D
          </button>
        </div>
      ) : null}
      {webgl2 ? (
        <label className="flex h-11 items-center overflow-hidden rounded border border-line bg-panel md:h-9">
          <span className="sr-only">Terrain exaggeration</span>
          <select
            className="num h-full cursor-pointer appearance-none bg-transparent px-2.5 text-[13px] text-ink disabled:opacity-40"
            value={exaggeration}
            disabled={!is3D}
            onChange={(e) => onExaggeration(Number(e.target.value))}
          >
            {[1, 2, 3, 5].map((x) => (
              <option key={x} value={x}>
                {x}x
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button type="button" className={`${BTN} rounded border border-line`} onClick={onResetBearing} aria-label={`Reset bearing to north. Bearing is ${Math.round(bearing)} degrees`}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden style={{ rotate: `${-bearing}deg` }}>
          <path d="M9 1.5 12.5 9h-7z" fill="#e76f51" stroke="#0d2230" strokeWidth="0.6" />
          <path d="M9 16.5 5.5 9h7z" fill="#f8fafb" stroke="#0d2230" strokeWidth="0.6" />
        </svg>
      </button>
      <button type="button" className={`${BTN} rounded border border-line`} onClick={onFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          {isFullscreen ? <path d="M6 1v5H1M10 1v5h5M6 15v-5H1M10 15v-5h5" /> : <path d="M1 6V1h5M15 6V1h-5M1 10v5h5M15 10v5h-5" />}
        </svg>
      </button>
    </div>
  );
}
