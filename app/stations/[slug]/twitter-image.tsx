import Image from "./opengraph-image";
import { OG_SIZE, OG_TYPE } from "@/lib/og/card";
import { STATIONS } from "@/lib/stations";

export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "Tide station headline: the next king tide height in feet above MLLW.";

export function generateStaticParams() {
  return STATIONS.map((s) => ({ slug: s.slug }));
}

export default Image;
