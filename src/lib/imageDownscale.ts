"use client";

/**
 * Re-encoding an oversized menu photo in the browser so it fits the upload cap.
 *
 * The cap is not the model's: a Vercel function refuses a request body over
 * 4.5 MB at the infrastructure level, and an uploaded file crosses it as
 * base64, which inflates by a third. A 12 MB phone photo of a menu is
 * therefore refused — even though the same photo carries perhaps 2 MB of
 * actual information, the rest being sensor resolution no OCR needs.
 *
 * So it is redrawn smaller rather than rejected. What matters is that the
 * prices stay readable, which is why the floor below is a hard one: past it
 * the file gets smaller and the menu stops being legible, and a scan that
 * misreads prices is worse than one that never ran.
 */

/**
 * Where the first attempt lands. A 2600px-wide menu photo resolves small
 * print comfortably, and lands under 3 MB at JPEG quality 0.85 for all but the
 * busiest images.
 */
const START_LONG_EDGE = 2600;

/** Below this, menu small print starts breaking up. Never crossed. */
const MIN_LONG_EDGE = 1500;

/** Tried in order at each size before the image is made smaller again. */
const QUALITY_STEPS = [0.85, 0.72, 0.6];

/** Each step down. Gentle enough not to overshoot past legibility. */
const SCALE_STEP = 0.75;

/**
 * Aim under the cap, not at it: the file still has to survive base64 and a
 * JSON envelope on its way to the function.
 */
export const SHRINK_HEADROOM = 0.9;

export interface ShrinkOutcome {
  /** The re-encoded file, or the original when nothing had to be done. */
  file: File;
  changed: boolean;
  originalBytes: number;
  bytes: number;
  width: number;
  height: number;
  /** True when even the smallest legible version is still over budget. */
  stillTooBig: boolean;
}

/** Formats an image the browser can decode and re-encode. */
export function canShrink(file: File): boolean {
  return /^image\/(jpeg|jpg|png|webp)$/i.test(file.type);
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality),
  );
}

function asFile(blob: Blob, originalName: string): File {
  const base = originalName.replace(/\.[^.]+$/, "") || "menu";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

/**
 * Redraw `file` until it fits `maxBytes`, or until making it smaller would
 * cost legibility.
 *
 * Always resolves — a file that cannot be brought under budget comes back with
 * `stillTooBig`, carrying the smallest version reached so the caller can say
 * how close it got instead of just "too large".
 */
export async function shrinkImageToFit(
  file: File,
  maxBytes: number,
): Promise<ShrinkOutcome> {
  const unchanged = (): ShrinkOutcome => ({
    file,
    changed: false,
    originalBytes: file.size,
    bytes: file.size,
    width: 0,
    height: 0,
    stillTooBig: file.size > maxBytes,
  });

  if (file.size <= maxBytes) return unchanged();

  // `from-image` keeps a phone photo the way up it was taken; without it an
  // EXIF-rotated picture is redrawn on its side, which OCR reads as noise.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close?.();
    return unchanged();
  }

  const sourceLongEdge = Math.max(bitmap.width, bitmap.height);
  let longEdge = Math.min(START_LONG_EDGE, sourceLongEdge);
  let best: { blob: Blob; width: number; height: number } | null = null;

  try {
    for (;;) {
      const scale = longEdge / sourceLongEdge;
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));

      canvas.width = width;
      canvas.height = height;
      // JPEG has no alpha: a transparent PNG would otherwise flatten onto
      // black and take its black text with it.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of QUALITY_STEPS) {
        const blob = await toBlob(canvas, quality);
        if (!blob) continue;
        if (!best || blob.size < best.blob.size) best = { blob, width, height };
        if (blob.size <= maxBytes) {
          return {
            file: asFile(blob, file.name),
            changed: true,
            originalBytes: file.size,
            bytes: blob.size,
            width,
            height,
            stillTooBig: false,
          };
        }
      }

      if (longEdge <= MIN_LONG_EDGE) break;
      longEdge = Math.max(MIN_LONG_EDGE, Math.round(longEdge * SCALE_STEP));
    }
  } finally {
    bitmap.close?.();
  }

  if (!best) return unchanged();

  return {
    file: asFile(best.blob, file.name),
    changed: true,
    originalBytes: file.size,
    bytes: best.blob.size,
    width: best.width,
    height: best.height,
    stillTooBig: best.blob.size > maxBytes,
  };
}
