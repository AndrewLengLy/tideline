import type { Metadata } from "next";
import { MapApp } from "@/components/app/MapApp";
import { getOverview } from "@/lib/data";
import { PLACES, SPOTS } from "@/lib/spots";
import { STATIONS } from "@/lib/stations";
import type { MapOverview, MapPlace, MapSpot, MapStation } from "@/lib/types";

export const revalidate = 3600;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function Home() {
  const overview = await getOverview();
  // Only what the map page uses goes to the browser. Flood history and spot details stay on their own pages.
  const slim: MapOverview = {
    asOf: overview.asOf,
    stations: overview.stations.map((s) => ({
      stationId: s.stationId,
      next: s.next,
      kings: s.kingTides.map((k) => [k.t, k.height]),
      daysOver: s.daysOver,
      thresholdKind: s.thresholdKind,
    })),
  };
  const stations: MapStation[] = STATIONS.map(({ id, slug, name, lat, lng, facing, datums, thresholds }) => ({ id, slug, name, lat, lng, facing, datums, thresholds }));
  const spots: MapSpot[] = SPOTS.map(({ slug, name, lat, lng, facing, nearestStationId, fact, floodingReported, firstFloodFt }) => ({ slug, name, lat, lng, facing, nearestStationId, fact, floodingReported, firstFloodFt }));
  const places: MapPlace[] = PLACES.map(({ name, firstFloodFt }) => ({ name, firstFloodFt }));
  return <MapApp overview={slim} stations={stations} spots={spots} places={places} initialNow={overview.asOf} />;
}
