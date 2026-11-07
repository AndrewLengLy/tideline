import Link from "next/link";
import { fmtShortDay, fmtTime, fmtZone, ft } from "@/lib/format";
import { futureTideEquivalent } from "@/lib/metrics/king-tides";
import { isOfficialDate } from "@/lib/official-dates";
import type { KingTide } from "@/lib/types";
import { IcsButton } from "./app/IcsButton";

/** A row per tide: date, local time, height, and future-tide equivalent, with a calendar export. */
export function TideTable({ tides, showStation = false }: { tides: KingTide[]; showStation?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table num">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Local time</th>
            {showStation ? <th scope="col">Station</th> : null}
            <th scope="col">Height</th>
            <th scope="col">Future-tide equivalent</th>
            <th scope="col">
              <span className="sr-only">Calendar file</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tides.map((k) => (
            <tr key={`${k.stationId}-${k.t}`}>
              <td className="whitespace-nowrap">
                {fmtShortDay(k.t)}
                {isOfficialDate(k.t) ? <span className="ml-1.5 rounded-sm border border-link px-1 text-[12px] text-link">Coastal Commission date</span> : null}
              </td>
              <td className="whitespace-nowrap">
                {fmtTime(k.t)} {fmtZone(k.t)}
              </td>
              {showStation ? (
                <td className="whitespace-nowrap font-sans">
                  <Link className="text-link underline" href={`/stations/${k.stationSlug}`}>
                    {k.stationName}
                  </Link>
                </td>
              ) : null}
              <td className="whitespace-nowrap">{ft(k.height)}</td>
              <td className="whitespace-nowrap">{ft(futureTideEquivalent(k.aboveMhhw))}</td>
              <td className="!py-1">
                <IcsButton tide={k} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
