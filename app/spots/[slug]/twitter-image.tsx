import Image from "./opengraph-image";
import { OG_SIZE, OG_TYPE } from "@/lib/og/card";
import { SPOTS } from "@/lib/spots";

export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "Shoreline spot headline: the sea level rise step that first floods this place, in feet.";

export function generateStaticParams() {
  return SPOTS.map((s) => ({ slug: s.slug }));
}

export default Image;
