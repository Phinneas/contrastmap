/**
 * Tiny geo helpers for the zip search. Pure, no data import — the caller passes
 * the centroid table so this module stays reusable and testable.
 */

/** [latitude, longitude] pair. */
export type LatLng = [number, number];

const EARTH_RADIUS_MI = 3958.7613;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two [lat, lng] points, in miles. */
export function haversineMi(a: LatLng, b: LatLng): number {
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Resolve a 5-digit zip against a centroid table ({ "78702": [lat, lng] }). */
export function lookupZip(zip: string, table: Record<string, LatLng>): LatLng | null {
  if (!/^\d{5}$/.test(zip)) return null;
  return table[zip] ?? null;
}
