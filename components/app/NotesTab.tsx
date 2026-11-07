import Link from "next/link";
import { fmtMonthDay } from "@/lib/format";
import { LINKS } from "@/lib/site";
import { OFFICIAL_DATES } from "@/lib/official-dates";
import { dayStart } from "@/lib/time";

const LINK = "text-link underline";

/** Short field notes for the map. Links out to the deeper pages. */
export function NotesTab() {
  return (
    <div className="space-y-3 text-[14px] leading-snug">
      <p>A king tide is a preview of a future ordinary high tide. This map measures that gap at each gauge, then shows where the water lands.</p>
      <p>
        The slider counts feet of sea level rise above today&apos;s MHHW, the average height of the higher high tide each day. Tide numbers come from NOAA predictions. Water extents come from NOAA&apos;s Sea Level Rise Viewer, a screening tool. Local flooding also depends on storms and drainage, which these layers leave out.
      </p>
      <div>
        <h2 className="text-[15px]">Official king tide dates</h2>
        {OFFICIAL_DATES.length ? (
          <ul className="num mt-1 text-[13px]">
            {OFFICIAL_DATES.map((r) => (
              <li key={r.start}>
                {fmtMonthDay(dayStart(r.start) + 43_200_000)} to {fmtMonthDay(dayStart(r.end) + 43_200_000)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1">
            The California Coastal Commission confirms statewide dates each fall. Tideline computes its own highest tides from NOAA predictions and lists the Commission&apos;s dates here once added. Current dates are on the{" "}
            <a className={LINK} href={LINKS.kingTides}>
              California King Tides Project
            </a>{" "}
            site.
          </p>
        )}
      </div>
      <div>
        <h2 className="text-[15px]">Photograph a king tide</h2>
        <p className="mt-1">
          The Project collects photos through its{" "}
          <a className={LINK} href={LINKS.kingTidesUpload}>
            upload form
          </a>
          .
        </p>
      </div>
      <ul className="space-y-1">
        <li>
          <Link className={LINK} href="/king-tides">
            King tide calendar
          </Link>
        </li>
        <li>
          <Link className={LINK} href="/stations">
            Tide stations
          </Link>
        </li>
        <li>
          <Link className={LINK} href="/spots">
            Shoreline spots
          </Link>
        </li>
        <li>
          <Link className={LINK} href="/methodology">
            Methodology and limits
          </Link>
        </li>
      </ul>
    </div>
  );
}
