import { getStationLive } from "@/lib/data";
import { stationById } from "@/lib/stations";

/**
 * Rendered on every request. The CDN keeps a copy for 5 minutes and may hand it out for 1 more
 * minute while a fresh one builds, so a quiet week can never leave a week-old reading behind.
 */
const CDN_CACHE = "public, s-maxage=300, stale-while-revalidate=60";

/** The last 72 hours of observed water level, with residual and surge. */
export async function GET(_request: Request, ctx: { params: Promise<{ station: string }> }) {
  const { station } = await ctx.params;
  if (!stationById(station)) return Response.json({ error: "Unknown station" }, { status: 404 });
  // The observed request skips the Next.js data cache. That cache also serves stale copies first.
  const live = await getStationLive(station, Date.now(), { fresh: true });
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
    { headers: { "Cache-Control": CDN_CACHE } },
  );
}
