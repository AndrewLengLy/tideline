import { getStationLive } from "@/lib/data";
import { STATIONS, stationById } from "@/lib/stations";

export const revalidate = 360;
export const dynamicParams = false;
export function generateStaticParams() {
  return STATIONS.map((s) => ({ station: s.id }));
}

/** The last 72 hours of observed water level, with residual and surge. */
export async function GET(_request: Request, ctx: { params: Promise<{ station: string }> }) {
  const { station } = await ctx.params;
  if (!stationById(station)) return Response.json({ error: "Unknown station" }, { status: 404 });
  const live = await getStationLive(station);
  return Response.json(
    {
      station,
      asOf: live.asOf,
      t0: live.observed[0]?.t ?? live.asOf,
      // Rows are [minutes after t0, feet], which is about half the size of full time stamps.
      observed: live.observed.map((p) => [Math.round((p.t - (live.observed[0]?.t ?? 0)) / 60_000), p.v]),
      residual: live.residual.map((p) => [Math.round((p.t - (live.observed[0]?.t ?? 0)) / 60_000), p.v]),
      surge: live.surge,
    },
    { headers: { "Cache-Control": "public, s-maxage=360, stale-while-revalidate=60" } },
  );
}
