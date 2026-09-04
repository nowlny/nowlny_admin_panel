/* ---------------------------------------------------------------------------
   Unsigned Cloudinary image uploads.

   The API stores image *links*: `logo` and `backgroundImageUrl` on a restaurant
   are plain URLs, and the one upload endpoint the backend exposes —
   `POST /restaurants/me/profile-images` — is scoped to the signed-in merchant,
   so an admin creating someone else's store cannot use it.

   The merchant apps (`nowlny_restaurant`, `nowlny_restaurant_admin`) solve the
   same problem by posting straight to Cloudinary with the unsigned `ml_default`
   preset and keeping `secure_url`, which is why every merchant-uploaded image
   on the platform sits under `res.cloudinary.com/dtm5iglra`. Admin does the
   same here so a store created from this portal keeps its artwork on the same
   CDN instead of pointing at whatever host the operator happened to paste —
   Instagram CDN links, the previous fallback, carry an `oe=` expiry and go dead.
--------------------------------------------------------------------------- */

const CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "dtm5iglra";
const UPLOAD_PRESET =
  process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "ml_default";

/** Mirrors the 5 MB per-file cap on the backend's own image endpoint. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Which check failed, so the caller can pick the translated message. */
export type ImageUploadFailure = "type" | "size" | "upload";

export class ImageUploadError extends Error {
  readonly reason: ImageUploadFailure;

  constructor(reason: ImageUploadFailure, message: string) {
    super(message);
    this.name = "ImageUploadError";
    this.reason = reason;
  }
}

/**
 * Rejects what Cloudinary would reject anyway, but before a multi-megabyte
 * round trip: a video or PDF picked by mistake, and anything over the cap.
 */
export function assertUploadableImage(file: File): void {
  if (!file.type.startsWith("image/")) {
    throw new ImageUploadError("type", "That file is not an image.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageUploadError("size", "That image is too large.");
  }
}

export interface UploadImageOptions {
  signal?: AbortSignal;
}

/** True for links already served by our own Cloudinary cloud. */
export function isHostedImage(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "res.cloudinary.com" &&
      parsed.pathname.startsWith(`/${CLOUD_NAME}/`)
    );
  } catch {
    return false;
  }
}

/** Uploads `file` and resolves to its permanent `https://res.cloudinary.com` URL. */
export async function uploadImage(
  file: File,
  options: UploadImageOptions = {},
): Promise<string> {
  assertUploadableImage(file);
  return send(file, options);
}

/**
 * Re-hosts an image that lives somewhere else, by handing Cloudinary the link
 * and letting it do the fetching.
 *
 * A pasted link is not a stored image: Instagram CDN URLs carry an `oe=`
 * expiry and die within days, and plenty of hosts refuse to be hot-linked at
 * all, which is why a pasted logo would show in the form and then be broken in
 * the app. The browser can't fetch it itself — cross-origin reads are blocked
 * for exactly these hosts — so Cloudinary's server does it instead, and what we
 * store is a copy we own.
 */
export async function uploadImageFromUrl(
  remoteUrl: string,
  options: UploadImageOptions = {},
): Promise<string> {
  const trimmed = remoteUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new ImageUploadError("type", "That is not an image link.");
  }
  return send(trimmed, options);
}

/** `File` or remote URL — Cloudinary takes either as `file`. */
async function send(
  file: File | string,
  { signal }: UploadImageOptions,
): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", UPLOAD_PRESET);
  body.append("cloud_name", CLOUD_NAME);

  let payload: { secure_url?: string; url?: string; error?: { message?: string } };
  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: "POST", body, signal },
    );
    payload = await res.json();
  } catch (err) {
    // An aborted upload is the component unmounting or the operator picking a
    // different file — it must not surface as an error toast.
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ImageUploadError(
      "upload",
      err instanceof Error ? err.message : "Upload failed.",
    );
  }

  const url = payload.secure_url || payload.url;
  if (!url) {
    throw new ImageUploadError(
      "upload",
      payload.error?.message || "Upload failed.",
    );
  }
  return url;
}

/** Bytes as the whole-or-one-decimal MB figure the size warning quotes. */
export function megabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? String(Math.round(mb)) : mb.toFixed(1);
}
