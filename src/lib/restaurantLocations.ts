/**
 * Sorting restaurants into the ones a map can show and the ones it can't.
 *
 * Two things go wrong with merchant coordinates, and they need different
 * answers. A restaurant with **no** location never appears on the map at all,
 * so it has to be listed somewhere or it is invisible. A restaurant with a
 * *wrong* location is worse: it appears, confidently, in the sea — this
 * platform has three whose longitude is a digit off (35.50 typed as 11.50,
 * 25.48, 30.51), which puts a Beirut shawarma shop off the coast of Tunisia.
 * Both are findable here so the operator can go and fix them.
 */

export interface LocatableRestaurant {
  id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  restaurantAddress?: { latitude?: number | null; longitude?: number | null } | null;
}

export interface PlacedRestaurant<T> {
  restaurant: T;
  lat: number;
  lng: number;
  /** True when the point is far from every other restaurant on the platform. */
  suspect: boolean;
}

export interface LocationSplit<T> {
  /** Everything with usable coordinates, suspect ones included. */
  placed: PlacedRestaurant<T>[];
  /** Placed, but implausibly far from the rest — almost always a typo. */
  suspect: PlacedRestaurant<T>[];
  /** No coordinates at all. These cannot be shown on a map. */
  missing: T[];
  /** Where to open the map: the median of the sane points. */
  center: [number, number];
  /** Corners enclosing the sane points, or null when there are none. */
  bounds: [[number, number], [number, number]] | null;
}

/** Beirut. Where the map looks when there is nothing to aim it at. */
export const DEFAULT_CENTER: [number, number] = [33.8938, 35.5018];

/**
 * How far from the crowd counts as wrong.
 *
 * Generous on purpose: a platform serving one city has every merchant inside a
 * few dozen kilometres, and one serving a country still fits well inside this.
 * It is meant to catch a mistyped digit, not an outlying suburb.
 */
const SUSPECT_KM = 300;

/** Below this there is no "crowd" to be far from, so nothing is called wrong. */
const MIN_FOR_OUTLIERS = 5;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Great-circle distance in kilometres. */
function distanceKm(a: [number, number], b: [number, number]): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Coordinates off a restaurant, wherever this endpoint happens to put them. */
function readPoint(
  restaurant: LocatableRestaurant,
): [number, number] | null {
  // The list endpoint answers with top-level numbers and no address at all;
  // the detail endpoint carries both. Either is fine.
  const lat = Number(restaurant.latitude ?? restaurant.restaurantAddress?.latitude);
  const lng = Number(restaurant.longitude ?? restaurant.restaurantAddress?.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  // 0,0 is the Atlantic. It is what an unset coordinate looks like, never a
  // restaurant.
  if (lat === 0 && lng === 0) return null;

  return [lat, lng];
}

export function splitByLocation<T extends LocatableRestaurant>(
  restaurants: T[],
): LocationSplit<T> {
  const placed: PlacedRestaurant<T>[] = [];
  const missing: T[] = [];

  for (const restaurant of restaurants) {
    const point = readPoint(restaurant);
    if (point) {
      placed.push({ restaurant, lat: point[0], lng: point[1], suspect: false });
    } else {
      missing.push(restaurant);
    }
  }

  if (placed.length === 0) {
    return { placed, suspect: [], missing, center: DEFAULT_CENTER, bounds: null };
  }

  // The median, not the mean: one restaurant in the wrong hemisphere would
  // drag a mean centre halfway there and take the whole map with it.
  const centre: [number, number] = [
    median(placed.map((entry) => entry.lat)),
    median(placed.map((entry) => entry.lng)),
  ];

  if (placed.length >= MIN_FOR_OUTLIERS) {
    for (const entry of placed) {
      entry.suspect = distanceKm([entry.lat, entry.lng], centre) > SUSPECT_KM;
    }
  }

  // Framed on the sane points, so three typos cannot zoom the map out to a
  // continent — the suspects are still drawn, and listed to the side.
  const sane = placed.filter((entry) => !entry.suspect);
  const framed = sane.length > 0 ? sane : placed;

  return {
    placed,
    suspect: placed.filter((entry) => entry.suspect),
    missing,
    center: centre,
    bounds: [
      [
        Math.min(...framed.map((entry) => entry.lat)),
        Math.min(...framed.map((entry) => entry.lng)),
      ],
      [
        Math.max(...framed.map((entry) => entry.lat)),
        Math.max(...framed.map((entry) => entry.lng)),
      ],
    ],
  };
}
