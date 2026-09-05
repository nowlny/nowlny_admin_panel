import { NextResponse } from "next/server";
import { fetchPublic } from "../../../lib/httpFallback";
import { isShortMapsLink, parseLatLng } from "../../../lib/mapsUrl";

/**
 * Resolving a shortened Google Maps link to the coordinates it points at.
 *
 * The Maps app's share sheet produces `https://maps.app.goo.gl/QHNeNBb…`,
 * which carries no coordinates at all — they only appear in the URL it
 * redirects to, and a browser cannot read that redirect cross-origin. So the
 * hop happens here.
 *
 * Deliberately narrow: only Google's own short-link hosts are followed, and a
 * caller must be signed in. Without both, this is a redirect-following fetch
 * proxy that anyone who finds the URL can point at an internal address.
 */

export const maxDuration = 15;

/** A share link resolves in well under this; anything slower is not one. */
const TIMEOUT_MS = 10_000;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!/^bearer\s+\S+/i.test(authHeader)) {
    return NextResponse.json(
      { error: "You must be signed in to resolve a map link." },
      { status: 401 },
    );
  }

  let url = "";
  try {
    const body = await request.json();
    url = typeof body?.url === "string" ? body.url.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isShortMapsLink(url)) {
    return NextResponse.json(
      {
        error:
          "That isn't a Google Maps short link. Paste the full link from the address bar instead.",
      },
      { status: 400 },
    );
  }

  let resolved: string;
  try {
    /*
     * Deliberately NOT pretending to be a browser.
     *
     * Google serves a short link two ways: to a browser User-Agent it returns
     * 200 and an HTML shell that finishes the redirect in JavaScript — no
     * destination we can read — while to anything else it answers with a plain
     * 302 whose `location` is the real place URL. A browser UA here silently
     * cost every lookup its answer.
     */
    const response = await fetchPublic(url, {
      headers: { Accept: "text/html", "Accept-Language": "en" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    resolved = response.url || "";
  } catch (error) {
    console.warn("[resolve-place] could not follow the link:", error);
    return NextResponse.json(
      {
        error:
          "That link couldn't be opened. Open it in a browser and paste the full address instead.",
      },
      { status: 502 },
    );
  }

  const found = parseLatLng(resolved);
  if (!found) {
    /*
     * The link resolved, but to a place *identifier* rather than a position —
     * `/place/Name/data=!4m2!3m1!1s0x151f…`. Google only turns that into
     * coordinates in the browser, so there is nothing further to follow: the
     * page it serves us carries no numbers either.
     *
     * The address bar does, though, the moment the place opens.
     */
    console.info(`[resolve-place] no coordinates in ${resolved.slice(0, 120)}`);
    return NextResponse.json(
      {
        error:
          "That short link points at a place but carries no coordinates. Open it, then copy the address from your browser's address bar — that one has them.",
      },
      { status: 422 },
    );
  }

  return NextResponse.json(found);
}
