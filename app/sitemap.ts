import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { SPOTS, SPOTS_CHECKED_AT } from "@/lib/spots";
import { STATIONS, STATIONS_GENERATED_AT } from "@/lib/stations";

export const revalidate = 86_400;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const stations = new Date(STATIONS_GENERATED_AT);
  const spots = SPOTS_CHECKED_AT ? new Date(SPOTS_CHECKED_AT) : now;
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/king-tides`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/stations`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/spots`, lastModified: spots, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/methodology`, lastModified: stations, changeFrequency: "monthly", priority: 0.6 },
    ...STATIONS.map((s) => ({ url: `${SITE_URL}/stations/${s.slug}`, lastModified: now, changeFrequency: "hourly" as const, priority: 0.8 })),
    ...SPOTS.map((s) => ({ url: `${SITE_URL}/spots/${s.slug}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.8 })),
  ];
}
