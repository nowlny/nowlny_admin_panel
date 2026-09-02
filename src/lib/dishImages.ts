/**
 * Stock-photo lookup for menu items the AI scanner extracted without a picture.
 *
 * Server-only: it reads provider API keys from the environment, so it must
 * never be imported from a `"use client"` module.
 *
 * Providers are tried in quality order and every one of them is optional:
 *
 *   PEXELS_API_KEY      — https://www.pexels.com/api/ (best food photography)
 *   UNSPLASH_ACCESS_KEY — https://unsplash.com/developers
 *
 * With neither key set the Wikimedia Commons search is used, which needs no
 * credentials at all — so the feature works on a fresh checkout, just with
 * less consistent photos.
 */

export type DishImageSource = "pexels" | "unsplash" | "wikimedia" | "fallback";

export interface DishImage {
  url: string;
  source: DishImageSource;
  /** Photographer / uploader, for stores that want to credit the shot. */
  credit?: string;
}

/** Per-call budget. A query costs up to four of these across the providers. */
const PROVIDER_TIMEOUT_MS = 6_000;

/**
 * Whole-batch budget, under the route's 60s `maxDuration`. A long menu whose
 * providers have gone slow stops searching here and takes the fallback for the
 * rest, rather than losing the entire response to a platform timeout.
 */
const BATCH_BUDGET_MS = 45_000;

/** How many candidates to ask each provider for, so we can skip duplicates. */
const CANDIDATES_PER_QUERY = 6;

/** Parallel provider lookups. Keeps a 60-dish menu well inside the timeout. */
const CONCURRENCY = 5;

/**
 * Last resort when every provider comes back empty — a generic plated-food
 * shot. Same asset the manual item editor already defaults to, so an
 * AI-imported dish and a hand-added one look alike.
 */
const GENERIC_FOOD_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80";

/** Wikimedia blocks default/blank user agents. */
const WIKIMEDIA_UA =
  "nowlny-admin-menu-importer/1.0 (https://nowlny.com; menu image lookup)";

interface Candidate {
  url: string;
  credit?: string;
}

/** Only the fields we read — each provider returns far more than this. */
interface PexelsResponse {
  photos?: {
    src?: { large?: string; medium?: string };
    photographer?: string;
  }[];
}

interface UnsplashResponse {
  results?: {
    urls?: { small?: string; regular?: string };
    user?: { name?: string };
  }[];
}

interface WikimediaResponse {
  query?: {
    pages?: Record<
      string,
      { index?: number; imageinfo?: { mime?: string; thumburl?: string }[] }
    >;
  };
}

async function getJson<T>(url: string, headers?: HeadersInit): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      console.warn(`[dish-images] ${new URL(url).host} responded ${response.status}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.warn(`[dish-images] lookup failed:`, error);
    return null;
  }
}

async function searchPexels(query: string, key: string): Promise<Candidate[]> {
  const url =
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}` +
    `&per_page=${CANDIDATES_PER_QUERY}&orientation=landscape`;
  const data = await getJson<PexelsResponse>(url, { Authorization: key });
  return (data?.photos ?? []).flatMap((photo) => {
    const url = photo.src?.large ?? photo.src?.medium;
    if (!url) return [];
    const credit = photo.photographer ? `${photo.photographer} / Pexels` : undefined;
    return [{ url, credit }];
  });
}

async function searchUnsplash(query: string, key: string): Promise<Candidate[]> {
  const url =
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}` +
    `&per_page=${CANDIDATES_PER_QUERY}&orientation=landscape&content_filter=high`;
  const data = await getJson<UnsplashResponse>(url, { Authorization: `Client-ID ${key}` });
  return (data?.results ?? []).flatMap((photo) => {
    const url = photo.urls?.small ?? photo.urls?.regular;
    if (!url) return [];
    const credit = photo.user?.name ? `${photo.user.name} / Unsplash` : undefined;
    return [{ url, credit }];
  });
}

/**
 * Keyless fallback. Commons' search is literal, so a long dish name matches
 * nothing — we retry on the first couple of words before giving up.
 */
async function searchWikimedia(query: string): Promise<Candidate[]> {
  const run = async (term: string): Promise<Candidate[]> => {
    const url =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json" +
      `&generator=search&gsrsearch=${encodeURIComponent(`${term} filetype:bitmap`)}` +
      `&gsrnamespace=6&gsrlimit=${CANDIDATES_PER_QUERY}` +
      "&prop=imageinfo&iiprop=url|mime&iiurlwidth=600";
    const data = await getJson<WikimediaResponse>(url, { "User-Agent": WIKIMEDIA_UA });
    const pages = data?.query?.pages;
    if (!pages) return [];

    return Object.values(pages)
      // The API returns pages keyed by id; `index` carries the search ranking.
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((page): Candidate | null => {
        const info = page.imageinfo?.[0];
        if (!/^image\/(jpeg|png|webp)$/.test(info?.mime ?? "")) return null;
        const thumb = info?.thumburl;
        if (typeof thumb !== "string") return null;
        // Commons appends analytics params we don't want to persist.
        return { url: thumb.split("?")[0], credit: "Wikimedia Commons" };
      })
      .filter((candidate): candidate is Candidate => candidate !== null);
  };

  const direct = await run(query);
  if (direct.length > 0) return direct;

  const shortened = query.split(/\s+/).filter(Boolean).slice(0, 2).join(" ");
  if (!shortened || shortened === query) return [];
  return run(shortened);
}

async function findCandidates(query: string): Promise<{ candidates: Candidate[]; source: DishImageSource } | null> {
  const pexelsKey = process.env.PEXELS_API_KEY;
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;

  if (pexelsKey) {
    const candidates = await searchPexels(query, pexelsKey);
    if (candidates.length > 0) return { candidates, source: "pexels" };
  }

  if (unsplashKey) {
    const candidates = await searchUnsplash(query, unsplashKey);
    if (candidates.length > 0) return { candidates, source: "unsplash" };
  }

  const candidates = await searchWikimedia(query);
  if (candidates.length > 0) return { candidates, source: "wikimedia" };

  return null;
}

/**
 * Resolve one photo per query, in the order given.
 *
 * Identical queries are looked up once, and a photo already handed to another
 * dish is skipped where the provider gave us an alternative — a menu where
 * every dish shows the same picture reads as broken.
 *
 * @param queries  Search phrases, one per item. Empty entries resolve to null.
 * @param useFallback  Return the generic food shot instead of null when no
 *                     provider matched, so no imported dish is left blank.
 */
export async function findDishImages(
  queries: (string | null | undefined)[],
  useFallback = true,
): Promise<(DishImage | null)[]> {
  const unique = [...new Set(
    queries
      .map((query) => (typeof query === "string" ? query.trim() : ""))
      .filter((query) => query.length > 0),
  )];

  const byQuery = new Map<string, Candidate[]>();
  const sourceByQuery = new Map<string, DishImageSource>();

  const deadline = Date.now() + BATCH_BUDGET_MS;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, unique.length) }, async () => {
    while (cursor < unique.length && Date.now() < deadline) {
      const query = unique[cursor++];
      const found = await findCandidates(query);
      if (found) {
        byQuery.set(query, found.candidates);
        sourceByQuery.set(query, found.source);
      }
    }
  });
  await Promise.all(workers);

  // Assignment is a second, sequential pass so "don't reuse a photo" is
  // decided in the caller's item order rather than in lookup-completion order.
  const used = new Set<string>();
  return queries.map((raw) => {
    const query = typeof raw === "string" ? raw.trim() : "";
    // An empty slot means the caller's item already has a picture — it must
    // come back empty rather than collecting a stand-in it doesn't need.
    if (!query) return null;

    const candidates = byQuery.get(query);
    if (candidates && candidates.length > 0) {
      const fresh = candidates.find((candidate) => !used.has(candidate.url)) ?? candidates[0];
      used.add(fresh.url);
      return {
        url: fresh.url,
        source: sourceByQuery.get(query) ?? "wikimedia",
        credit: fresh.credit,
      };
    }

    return useFallback ? { url: GENERIC_FOOD_IMAGE, source: "fallback" } : null;
  });
}
