import { OG_SIZE, OG_TYPE, ogCard } from "@/lib/og/card";
import { spotBySlug, SPOTS } from "@/lib/spots";

export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "Shoreline spot headline: the sea level rise step that first floods this place, in feet.";

export function generateStaticParams() {
  return SPOTS.map((s) => ({ slug: s.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const spot = spotBySlug(slug);
  const flood = spot?.firstFloodFt ?? null;
  return ogCard({
    kicker: spot?.name ?? "Shoreline spot",
    number: flood === null ? "10+" : String(flood),
    unit: "ft",
    line: "Sea level rise that first floods this spot on NOAA's layer",
  });
}
