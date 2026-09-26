/* ---------------------------------------------------------------------------
   Reading a public Instagram reel/post link.

   A link like `https://www.instagram.com/reel/Db5HDjBkUJD/?utm_source=…` is a
   web page, not a video, and the page Instagram serves to a logged-out
   request carries no media. Its *embed* page does: `/p/{code}/embed/captioned/`
   ships a `contextJSON` blob holding the same `shortcode_media` record the web
   app uses — `video_url`, the cover frame and the caption — without a login.

   The media URLs in it are signed fbcdn links with an `oe=` expiry, so they are
   only good for copying from right away, never for storing.
--------------------------------------------------------------------------- */

/** `instagram.com/reel/CODE`, `/reels/CODE`, `/p/CODE`, `/tv/CODE`, with or without `www.`/query. */
const LINK_RE =
  /^https?:\/\/(?:www\.|m\.)?instagram\.com\/(?:[A-Za-z0-9._]+\/)?(?:reels?|p|tv)\/([A-Za-z0-9_-]{5,})/i;

/** The post's shortcode, or `null` when `url` isn't an Instagram post/reel link. */
export function instagramShortcode(url: string): string | null {
  return LINK_RE.exec(url.trim())?.[1] ?? null;
}

export function isInstagramLink(url: string): boolean {
  return instagramShortcode(url) !== null;
}

export interface InstagramMedia {
  shortcode: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  owner: string | null;
}

/** The slice of Instagram's `shortcode_media` record read here. */
interface ShortcodeMedia {
  is_video?: boolean;
  video_url?: string;
  display_url?: string;
  edge_sidecar_to_children?: { edges?: { node?: ShortcodeMedia }[] };
  edge_media_to_caption?: { edges?: { node?: { text?: unknown } }[] };
  owner?: { username?: string };
}

/** Which step failed, so the route can answer with the right status and message. */
export type InstagramFailure = "not_video" | "unavailable";

export class InstagramError extends Error {
  readonly reason: InstagramFailure;

  constructor(reason: InstagramFailure, message: string) {
    super(message);
    this.name = "InstagramError";
    this.reason = reason;
  }
}

export function embedUrl(shortcode: string): string {
  return `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
}

/**
 * Pulls the media record out of an embed page's HTML.
 *
 * `contextJSON` is JSON encoded *as a string* inside the page's own JSON, so
 * it is decoded twice: once as the string literal it sits in, then as JSON.
 */
export function parseEmbedHtml(html: string, shortcode: string): InstagramMedia {
  const match = /"contextJSON":("(?:[^"\\]|\\.)*")/.exec(html);
  if (!match) {
    throw new InstagramError(
      "unavailable",
      "Instagram didn't return this post. It may be private, deleted, or from an account that blocks embedding.",
    );
  }

  let media: ShortcodeMedia | undefined;
  try {
    const context = JSON.parse(JSON.parse(match[1]) as string);
    media = context?.gql_data?.shortcode_media ?? context?.context?.media;
  } catch {
    throw new InstagramError("unavailable", "Instagram's response couldn't be read.");
  }
  if (!media) {
    throw new InstagramError(
      "unavailable",
      "Instagram didn't return this post. It may be private, deleted, or age-restricted.",
    );
  }

  // A carousel can hold a video among its slides; take the first one.
  const slides = media.edge_sidecar_to_children?.edges?.map((e) => e?.node) ?? [];
  const video = media.is_video ? media : slides.find((s) => s?.is_video && s?.video_url);
  if (!video?.video_url) {
    throw new InstagramError("not_video", "That Instagram post is a photo, not a video.");
  }

  const caption = media.edge_media_to_caption?.edges?.[0]?.node?.text;
  return {
    shortcode,
    videoUrl: String(video.video_url),
    thumbnailUrl: video.display_url || media.display_url || null,
    caption: typeof caption === "string" && caption.trim() ? caption.trim() : null,
    owner: media.owner?.username ?? null,
  };
}
