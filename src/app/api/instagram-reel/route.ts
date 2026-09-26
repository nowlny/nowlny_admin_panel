import { NextResponse } from "next/server";
import {
  embedUrl,
  InstagramError,
  type InstagramMedia,
  instagramShortcode,
  parseEmbedHtml,
} from "../../../lib/instagram";
import { MAX_VIDEO_BYTES, uploadBlob, videoPosterUrl } from "../../../lib/cloudinary";

/**
 * Turning a public Instagram reel link into a video we host.
 *
 * The browser can't do any of this itself: the reel page and its fbcdn media
 * are cross-origin, and the media links are signed with an `oe=` expiry, so a
 * stored fbcdn URL would play for a few days and then die. Here the clip is
 * found on the embed page, downloaded, and uploaded to our Cloudinary — what
 * comes back is a permanent `res.cloudinary.com` URL.
 *
 * Deliberately narrow: only instagram.com post/reel links are accepted (the
 * media URL is then taken from Instagram's own response, never the caller),
 * and a caller must be signed in. Without both, this is a fetch proxy.
 */

export const maxDuration = 60;

const PAGE_TIMEOUT_MS = 12_000;
const MEDIA_TIMEOUT_MS = 40_000;

/**
 * Who we say we are when reading the embed page.
 *
 * Not a desktop browser: a full desktop Chrome User-Agent is served the
 * JavaScript app shell with no media in it. Meta's own link-preview crawler
 * gets the server-rendered embed, as does mobile Safari, which is kept as the
 * fallback in case one of them starts getting the shell too.
 */
const PAGE_USER_AGENTS = [
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
];

async function readEmbed(shortcode: string): Promise<InstagramMedia> {
  let lastError: unknown;
  for (const userAgent of PAGE_USER_AGENTS) {
    try {
      const res = await fetch(embedUrl(shortcode), {
        headers: { "User-Agent": userAgent, "Accept-Language": "en" },
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      });
      if (!res.ok) throw new InstagramError("unavailable", `Instagram answered ${res.status}.`);
      return parseEmbedHtml(await res.text(), shortcode);
    } catch (error) {
      // A photo post is a real answer, not a reason to ask again.
      if (error instanceof InstagramError && error.reason === "not_video") throw error;
      lastError = error;
    }
  }
  throw lastError;
}

/** Only Instagram's own CDNs — the URL came from their page, but check anyway. */
function isInstagramCdn(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return (
      protocol === "https:" &&
      (hostname.endsWith(".fbcdn.net") || hostname.endsWith(".cdninstagram.com"))
    );
  } catch {
    return false;
  }
}

async function download(url: string, limit: number): Promise<Blob> {
  if (!isInstagramCdn(url)) throw new Error(`Unexpected media host: ${url.slice(0, 80)}`);
  const res = await fetch(url, {
    headers: { "User-Agent": PAGE_USER_AGENTS[1] },
    signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Media fetch failed with ${res.status}`);
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > limit) throw new Error("too_large");
  const blob = await res.blob();
  if (blob.size > limit) throw new Error("too_large");
  return blob;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!/^bearer\s+\S+/i.test(authHeader)) {
    return NextResponse.json(
      { error: "You must be signed in to import an Instagram reel." },
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

  const shortcode = instagramShortcode(url);
  if (!shortcode) {
    return NextResponse.json(
      { error: "That isn't an Instagram reel or post link." },
      { status: 400 },
    );
  }

  let media: InstagramMedia;
  try {
    media = await readEmbed(shortcode);
  } catch (error) {
    if (error instanceof InstagramError) {
      console.info(`[instagram-reel] ${shortcode}: ${error.message}`);
      return NextResponse.json(
        { error: error.message },
        { status: error.reason === "not_video" ? 422 : 404 },
      );
    }
    console.warn(`[instagram-reel] ${shortcode}: page fetch failed`, error);
    return NextResponse.json(
      { error: "Instagram couldn't be reached. Try again in a moment." },
      { status: 502 },
    );
  }

  let videoUrl: string;
  try {
    const clip = await download(media.videoUrl, MAX_VIDEO_BYTES);
    videoUrl = await uploadBlob(clip, "video", `instagram-${shortcode}.mp4`);
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "too_large";
    console.warn(`[instagram-reel] ${shortcode}: video copy failed`, error);
    return NextResponse.json(
      {
        error: tooLarge
          ? "That reel is larger than 100 MB, which is more than we can host."
          : "The reel was found but couldn't be copied. Download it and upload the file instead.",
      },
      { status: 502 },
    );
  }

  // The cover the creator picked beats an arbitrary first frame, but it is
  // optional — fall back to a frame Cloudinary renders from the video.
  let thumbnailUrl = videoPosterUrl(videoUrl);
  if (media.thumbnailUrl) {
    try {
      const cover = await download(media.thumbnailUrl, 10 * 1024 * 1024);
      thumbnailUrl = await uploadBlob(cover, "image", `instagram-${shortcode}.jpg`);
    } catch (error) {
      console.info(`[instagram-reel] ${shortcode}: cover copy failed, using a video frame`, error);
    }
  }

  return NextResponse.json({
    videoUrl,
    thumbnailUrl,
    caption: media.caption,
    owner: media.owner,
  });
}
