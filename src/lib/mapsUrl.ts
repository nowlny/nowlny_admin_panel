/**
 * Pulling coordinates out of a Google Maps link.
 *
 * Operators have the restaurant open in Maps, not a latitude to hand. A shared
 * link already carries the answer — twice, in fact, and the two disagree:
 *
 *     .../place/Khalifeh+Restaurant/@33.8543876,35.5014028,17z/data=…!3d33.8543876!4d35.5039777…
 *                                   ^^^^^^^^^^^^^^^^^^^^^^^^          ^^^^^^^^^^^^^^^^^^^^^^^^
 *                                   where the map was centred          where the pin actually is
 *
 * The `@` pair is the viewport, which drifts as you pan; `!3d`/`!4d` is the
 * place itself. In that link they differ by 280 metres — enough to put a
 * delivery driver on the wrong street — so the pin wins whenever it is there.
 */

export interface LatLngPair {
  lat: number;
  lng: number;
  /**
   * Which part of the link this came from. `place` is the marker, `viewport`
   * the map centre, `plain` a bare "lat, lng" the operator typed.
   */
  source: "place" | "viewport" | "query" | "plain";
}

/** Real coordinates, and not the 0,0 that a failed parse loves to produce. */
function valid(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/** True for the shortened links the Maps app's share sheet produces. */
export function isShortMapsLink(value: string): boolean {
  return /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\//i.test(
    value.trim(),
  );
}

/**
 * The coordinates in `value`, or null.
 *
 * Accepts a full Maps URL in any of the shapes Google hands out, and a bare
 * "33.8543876, 35.5039777" for an operator who already has the numbers.
 */
export function parseLatLng(value: string): LatLngPair | null {
  const text = decodeURIComponent(value.trim());
  if (!text) return null;

  // The pin: `!3d<lat>!4d<lng>`, buried in the `data=` blob.
  const pin = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pin) {
    const lat = Number(pin[1]);
    const lng = Number(pin[2]);
    if (valid(lat, lng)) return { lat, lng, source: "place" };
  }

  // An explicit query: `?q=lat,lng`, `?query=lat,lng`, `&ll=lat,lng`,
  // `?center=lat,lng` — what the Maps URL API and "share this point" produce.
  const query = text.match(
    /[?&](?:q|query|ll|center|daddr|destination)=(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/i,
  );
  if (query) {
    const lat = Number(query[1]);
    const lng = Number(query[2]);
    if (valid(lat, lng)) return { lat, lng, source: "query" };
  }

  // The viewport: `@lat,lng,17z`. Only reached when there is no pin.
  const viewport = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (viewport) {
    const lat = Number(viewport[1]);
    const lng = Number(viewport[2]);
    if (valid(lat, lng)) return { lat, lng, source: "viewport" };
  }

  // Typed by hand. Anchored so a stray pair of numbers inside a URL that
  // matched nothing above cannot pass as coordinates.
  const plain = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (plain) {
    const lat = Number(plain[1]);
    const lng = Number(plain[2]);
    if (valid(lat, lng)) return { lat, lng, source: "plain" };
  }

  return null;
}
