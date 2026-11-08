"use client";

import Link from "next/link";
import { fmtLongDay, fmtTime, ft, onAPerson, vsHighTide } from "@/lib/format";
import { LINKS } from "@/lib/site";
import { lightAt, spotsToWatch, VIEW_WINDOW_MS } from "@/lib/metrics/visit";
import type { KingTide, MapSpot, MapStation } from "@/lib/types";
import { IcsButton } from "./IcsButton";

const LINK = "text-link underline";

interface Props {
  station: MapStation;
  next: KingTide | null;
  spots: MapSpot[];
  onSpot: (slug: string) => void;
  onShowTide: (t: number) => void;
}

/** Everything needed to go watch the next king tide in person. */
export function GoSeeIt({ station, next, spots, onSpot, onShowTide }: Props) {
  if (!next) {
    return (
      <div className="space-y-3 text-[14px]" data-testid="go-see-it">
        <h2 className="text-[17px]">Go see a king tide</h2>
        <p>NOAA predictions for {station.name} are unavailable right now. The calendar fills in on the next refresh.</p>
        <Link className={LINK} href="/king-tides">
          King tide calendar
        </Link>
      </div>
    );
  }

  const depth = onAPerson(next.aboveMhhw);
  const light = lightAt(next.t);
  const watch = spotsToWatch(station, spots);

  return (
    <div className="space-y-4 text-[14px] leading-snug" data-testid="go-see-it">
      <div>
        <h2 className="text-[17px]">Go see the next king tide</h2>
        <p className="num mt-1 text-[22px] font-medium leading-tight">{fmtLongDay(next.t)}</p>
        <p className="num text-[15px]">
          Peak at {fmtTime(next.t)}, {ft(next.height)} at {station.name}
        </p>
        <p className="mt-1">
          That is {vsHighTide(next.aboveMhhw)}
          {depth ? `, ${depth} on someone standing where an ordinary high tide stops` : ""}.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onShowTide(next.t)}
            className="inline-flex h-11 items-center rounded border border-ink bg-ink px-2.5 text-[13px] text-panel lg:h-8"
          >
            Show it on the map
          </button>
          <IcsButton tide={next} />
        </div>
      </div>

      <div>
        <h3 className="text-[14px]">When to arrive</h3>
        <p className="mt-0.5">
          Be there by <span className="num">{fmtTime(next.t - VIEW_WINDOW_MS)}</span>. The water stays close to its peak for about an hour on either side, until about{" "}
          <span className="num">{fmtTime(next.t + VIEW_WINDOW_MS)}</span>.
        </p>
        {light !== "day" ? (
          <p className="mt-1">
            {light === "dark" ? "This peak comes in the dark." : "This peak comes near sunrise or sunset."} Bring a light and keep well back from the edge.
          </p>
        ) : null}
      </div>

      {watch.length ? (
        <div>
          <h3 className="text-[14px]">Where to stand</h3>
          <ul className="mt-1 space-y-2.5">
            {watch.map((s) => (
              <li key={s.slug}>
                <button type="button" onClick={() => onSpot(s.slug)} className="text-left font-bold text-ink underline decoration-line underline-offset-2 hover:decoration-ink">
                  {s.name}
                </button>
                <p className="mt-0.5 text-[13px]">{s.fact}</p>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  {s.floodingReported ? "Water reported here at past king tides. " : ""}
                  {s.firstFloodFt !== null ? `NOAA's layer floods it at ${s.firstFloodFt} ft. ` : ""}
                  <Link className={LINK} href={`/spots/${s.slug}`}>
                    Spot page
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h3 className="text-[14px]">Before you go</h3>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          <li>Wind and low air pressure can push water past the prediction. Check the <a className={LINK} href={LINKS.nws}>National Weather Service Bay Area forecast</a> that morning.</li>
          <li>Stay off seawalls and wet rocks. Waves run up farther than usual at a king tide.</li>
          <li>Frame your photo on something you can find again, like a bench or a sign. Return at an ordinary high tide and take the same shot for a side by side.</li>
          <li>
            Send your photos to the{" "}
            <a className={LINK} href={LINKS.kingTidesUpload}>
              California King Tides Project
            </a>
            , which uses them to document future shorelines.
          </li>
        </ul>
      </div>
    </div>
  );
}
