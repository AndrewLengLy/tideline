const R_MILES = 3958.8;
const R_METERS = 6371008.8;
const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineMi(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.sqrt(h));
}

/** Web Mercator pixel position of a point at a zoom level, on a 256px tile grid. */
export function lngLatToPixel(lat: number, lng: number, z: number): { x: number; y: number } {
  const scale = 256 * 2 ** z;
  const x = ((lng + 180) / 360) * scale;
  const s = Math.sin(toRad(lat));
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
  return { x, y };
}

/** Offset a point by meters east and north. Close enough for sampling within a kilometer. */
export function offsetMeters(lat: number, lng: number, east: number, north: number): { lat: number; lng: number } {
  const dLat = (north / R_METERS) * (180 / Math.PI);
  const dLng = (east / (R_METERS * Math.cos(toRad(lat)))) * (180 / Math.PI);
  return { lat: lat + dLat, lng: lng + dLng };
}
