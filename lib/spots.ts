import raw from "../data/spots.json";
import type { Place, Spot } from "./types";

export const SPOTS = raw.spots as unknown as Spot[];
export const PLACES = raw.places as unknown as Place[];
export const SPOTS_CHECKED_AT = raw.checkedAt ? Date.parse(raw.checkedAt) : null;

const bySlug = new Map(SPOTS.map((s) => [s.slug, s]));
export const spotBySlug = (slug: string) => bySlug.get(slug);
