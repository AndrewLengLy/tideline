import { fetchCurve } from "@/lib/sources/coops";
import { stationById } from "@/lib/stations";
import { addDays, DAY, pacificDay } from "@/lib/time";

export const revalidate = 86_400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

const WINDOW_DAYS = 7;

/** Seven days of 6-minute predictions for one station, starting on a Pacific day. Times are minutes after t0. */
export async function GET(_request: Request, ctx: { params: Promise<{ station: string; from: string }> }) {
  const { station, from } = await ctx.params;
  if (!stationById(station)) return Response.json({ error: "Unknown station" }, { status: 404 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return Response.json({ error: "Bad date" }, { status: 400 });
  const today = pacificDay(Date.now());
  if (from < addDays(today, -60) || from > addDays(today, 366)) return Response.json({ error: "Date out of range" }, { status: 400 });

  const points = await fetchCurve(station, from, WINDOW_DAYS);
  const t0 = points[0]?.t ?? Date.now() - DAY;
  return Response.json(
    { station, from, t0, t: points.map((p) => Math.round((p.t - t0) / 60_000)), v: points.map((p) => Number(p.v.toFixed(3))) },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" } },
  );
}
