import { fetchPublic } from "./httpFallback";

/**
 * Making a pasted payload's photo paths point at where the photos actually are.
 *
 * A platform's JSON stores a path for its own front end, not for us, and the
 * two rarely match the CDN one-to-one. qrmenu.com is the clean example: the
 * payload says
 *
 *     /menus/فرن-زراقط/mydop-images/img305b….webp
 *
 * while the file is served from
 *
 *     https://cdn.qrmenu.com/فرن-زراقط/mydop-images/img305b….webp
 *
 * — same file, one leading segment fewer. The operator cannot be expected to
 * work that out, and hard-coding it would fix one platform and no other. So a
 * single photo is fetched, and if it is not there the same URL is tried with
 * leading segments removed until one answers with an image. Whatever worked is
 * then applied to every other photo in the menu.
 *
 * (Encoding needs no help: `new URL` already percent-encodes an Arabic path
 * segment correctly.)
 */

/** One probe should be quick; the import is waiting on it. */
const PROBE_TIMEOUT_MS = 6_000;

/**
 * Total spent looking, however many candidates are left.
 *
 * Each candidate can cost two requests (HEAD, then GET for a CDN that refuses
 * HEAD), so an unresponsive host could otherwise burn the whole serverless
 * budget on photographs — and photographs are the part of an import we can
 * most afford to lose.
 */
const REPAIR_BUDGET_MS = 12_000;

/** How many leading path segments are worth trying to drop. */
const MAX_SEGMENTS_DROPPED = 3;

export interface ImageRepair {
  images: string[];
  /** How many leading path segments had to go. 0 = the paths were already right. */
  droppedSegments: number;
  /** False when nothing could be confirmed and the originals were kept. */
  repaired: boolean;
}

/** True when `url` serves an actual image. */
async function servesAnImage(url: string): Promise<boolean> {
  const attempt = async (method: "HEAD" | "GET"): Promise<Response | null> => {
    try {
      return await fetchPublic(url, {
        method,
        // A byte is enough to see the headers without pulling the photo down.
        ...(method === "GET" ? { headers: { Range: "bytes=0-0" } } : {}),
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        redirect: "follow",
      });
    } catch {
      return null;
    }
  };

  let response = await attempt("HEAD");
  // Plenty of CDNs answer HEAD with 405 while serving GET perfectly well.
  if (!response || response.status === 405 || response.status === 501) {
    response = await attempt("GET");
  }
  if (!response || !response.ok) return false;

  // A single-page app answers 200 with its shell for any path, which would
  // otherwise read as "the photo is there".
  const type = (response.headers.get("content-type") ?? "").toLowerCase();
  return type === "" || type.startsWith("image/");
}

/** The same URL with `count` leading path segments removed, or null. */
function withoutLeadingSegments(url: string, count: number): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length <= count) return null;

  parsed.pathname = `/${segments.slice(count).join("/")}`;
  return parsed.href;
}

/**
 * Check one photo, and fix the rest the same way.
 *
 * Never invents a change it could not confirm: if the original is unreachable
 * and no shorter path answers either, the URLs come back untouched — the
 * import then simply looks up stock photos, which is what it would have done
 * anyway.
 */
export async function repairImageUrls(images: string[]): Promise<ImageRepair> {
  const unchanged: ImageRepair = { images, droppedSegments: 0, repaired: false };
  const sample = images.find((image) => /^https?:\/\//i.test(image));
  if (!sample) return unchanged;

  const deadline = Date.now() + REPAIR_BUDGET_MS;

  if (await servesAnImage(sample)) {
    return { images, droppedSegments: 0, repaired: true };
  }

  for (let dropped = 1; dropped <= MAX_SEGMENTS_DROPPED; dropped += 1) {
    if (Date.now() >= deadline) {
      console.warn("[parse-menu] gave up checking photo URLs; out of time");
      break;
    }

    const candidate = withoutLeadingSegments(sample, dropped);
    if (!candidate) break;
    if (!(await servesAnImage(candidate))) continue;

    console.info(
      `[parse-menu] photo paths fixed by dropping ${dropped} leading segment(s)`,
    );
    return {
      images: images.map((image) => withoutLeadingSegments(image, dropped) ?? image),
      droppedSegments: dropped,
      repaired: true,
    };
  }

  console.warn("[parse-menu] could not confirm any photo URL; leaving them as they are");
  return unchanged;
}
