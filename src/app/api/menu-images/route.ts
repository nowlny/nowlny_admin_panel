import { NextResponse } from "next/server";
import { findDishImages } from "../../../lib/dishImages";

/**
 * Photo lookup for AI-imported menu items that came in without a picture.
 *
 * Split out of `/api/parse-menu` on purpose: the Gemini call already spends
 * most of the serverless budget, and keeping the searches in their own request
 * means a slow provider can never cost the operator the OCR result. It is also
 * separately retryable from the preview panel.
 *
 * Same auth posture as the scanner — it spends the project's provider quota,
 * so it can't be an open proxy.
 */

export const maxDuration = 60;

/**
 * Caps how many photos we go looking for. Counted over the dishes that
 * actually need one — the caller sends a full-length, index-aligned list, and
 * a 255-dish menu where most items already have a picture is a small job.
 */
const MAX_LOOKUPS = 250;

/** Bounds the payload itself, independent of how many need a lookup. */
const MAX_QUERIES = 1_000;

/** Long enough for "grilled chicken shawarma wrap", short enough to be a query. */
const MAX_QUERY_CHARS = 120;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!/^bearer\s+\S+/i.test(authHeader)) {
    return NextResponse.json(
      { error: "You must be signed in to look up dish photos." },
      { status: 401 },
    );
  }

  let body: { queries?: unknown; useFallback?: unknown };
  try {
    body = (await request.json()) ?? {};
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { queries, useFallback } = body;

  if (!Array.isArray(queries)) {
    return NextResponse.json(
      { error: "No dish names received in request." },
      { status: 400 },
    );
  }

  if (queries.length > MAX_QUERIES) {
    return NextResponse.json(
      { error: "That menu is too large to illustrate in one pass. Import it in smaller parts." },
      { status: 413 },
    );
  }

  // `null` entries are meaningful: they hold the slot for an item that already
  // has a picture, so the response stays index-aligned with the caller's list.
  const sanitized = queries.map((query: unknown) =>
    typeof query === "string" ? query.trim().slice(0, MAX_QUERY_CHARS) : null,
  );

  if (sanitized.filter(Boolean).length > MAX_LOOKUPS) {
    return NextResponse.json(
      {
        error: `That menu has too many dishes without a photo to fill in at once (limit ${MAX_LOOKUPS}). Import it in smaller parts.`,
      },
      { status: 413 },
    );
  }

  try {
    const images = await findDishImages(sanitized, useFallback !== false);
    return NextResponse.json({ images });
  } catch (error) {
    console.error("[menu-images] lookup failed:", error);
    return NextResponse.json(
      { error: "Couldn't fetch dish photos right now. You can add them manually." },
      { status: 502 },
    );
  }
}
