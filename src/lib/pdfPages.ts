"use client";

/**
 * Turning an oversized menu PDF into page images small enough to upload.
 *
 * Same wall as `imageDownscale`: the host refuses a request body over 4.5 MB,
 * and a 12 MB PDF cannot cross it. Unlike a photo, a PDF cannot simply be
 * re-encoded — so it is rendered, one page at a time, at a resolution that
 * keeps prices readable, and the scanner receives the pages instead of the
 * document. The route already knows how to read several pages as one menu.
 *
 * This is a fallback, not an upgrade: a PDF sent whole carries real text that
 * the model reads exactly, while a rendered page has to be OCR'd. It runs only
 * when the document would otherwise be refused outright.
 */

/** Past this a "menu" is a brochure; rendering them all would blow the budget. */
const MAX_PAGES = 12;

/**
 * Starting render size, in pixels on the page's long edge.
 *
 * A PDF page is measured in points, not pixels — 842pt for A4 — and its
 * contents are vector, so rendering *above* 1:1 costs nothing but pixels. 1800
 * across an A4 page is roughly 154 DPI, which holds 8pt price text together.
 * Clamping this to the page's own point size instead rendered A4 at 94 DPI and
 * quietly handed the scanner smeared decimals.
 */
const START_LONG_EDGE = 1800;

/** Below this, prices start to smear. */
const MIN_LONG_EDGE = 1100;

const QUALITY_STEPS = [0.8, 0.7, 0.6];

export interface PdfPage {
  /** Always `image/jpeg`. */
  mimeType: string;
  /** Base64 without the data: prefix, ready for the scan request. */
  base64: string;
  bytes: number;
}

export interface PdfRenderOutcome {
  pages: PdfPage[];
  totalBytes: number;
  /** Pages the document has beyond `MAX_PAGES`, which were not rendered. */
  skippedPages: number;
  /** True when even the smallest legible render is over budget. */
  stillTooBig: boolean;
}

export class PdfRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfRenderError";
  }
}

/**
 * How many pages a PDF has, without rendering any of them.
 *
 * Cheap enough to ask before deciding how to scan: a long document is read in
 * passes even when it is small enough to upload whole, because the ceiling
 * that stops a scan is the clock, not the file size.
 */
export async function pdfPageCount(file: File): Promise<number> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    disableAutoFetch: true,
  });
  try {
    const document_ = await task.promise;
    const pages = document_.numPages;
    await document_.loadingTask.destroy();
    return pages;
  } catch {
    await task.destroy().catch(() => {});
    return 0;
  }
}

export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality),
  );
}

async function toBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  // Chunked: one spread of a multi-megabyte array overflows the call stack.
  for (let i = 0; i < buffer.length; i += 0x8000) {
    binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * Render `file`'s pages as JPEGs whose combined size fits `budgetBytes`.
 *
 * The budget is split evenly across pages rather than spent first-come, so a
 * dense first page cannot leave nothing for the last one.
 */
export async function pdfToPageImages(
  file: File,
  budgetBytes: number,
): Promise<PdfRenderOutcome> {
  const pdfjs = await import("pdfjs-dist");
  // Bundled as an asset by the app's bundler rather than fetched from a CDN,
  // so this works offline and cannot drift from the library version.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  let document_;
  try {
    document_ = await pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      // Nothing here is streamed from a server, so there is nothing to
      // pre-fetch — and this file was not authored by us.
      disableAutoFetch: true,
    }).promise;
  } catch (error) {
    throw new PdfRenderError(
      error instanceof Error && /password/i.test(error.message)
        ? "That PDF is password protected, so its pages can't be read."
        : "That PDF couldn't be opened.",
    );
  }

  // Read before the document is torn down at the end.
  const documentPages = document_.numPages;
  const pageCount = Math.min(documentPages, MAX_PAGES);
  const perPageBudget = budgetBytes / Math.max(1, pageCount);
  const pages: PdfPage[] = [];
  let stillTooBig = false;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new PdfRenderError("This browser can't render PDF pages.");

  for (let number = 1; number <= pageCount; number += 1) {
    const page = await document_.getPage(number);
    const base = page.getViewport({ scale: 1 });
    // In points. Only ever used as the denominator for the pixel target.
    const pageLongEdge = Math.max(base.width, base.height);

    let longEdge = START_LONG_EDGE;
    let best: Blob | null = null;

    for (;;) {
      const viewport = page.getViewport({ scale: longEdge / pageLongEdge });
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      // Pages are transparent where nothing is drawn; on JPEG that becomes
      // black, and black text on black is not a menu.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvas, canvasContext: context, viewport }).promise;

      let fits = false;
      for (const quality of QUALITY_STEPS) {
        const blob = await toBlob(canvas, quality);
        if (!blob) continue;
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= perPageBudget) {
          fits = true;
          break;
        }
      }
      if (fits || longEdge <= MIN_LONG_EDGE) break;
      longEdge = Math.max(MIN_LONG_EDGE, Math.round(longEdge * 0.8));
    }

    page.cleanup();
    if (!best) continue;
    if (best.size > perPageBudget) stillTooBig = true;

    pages.push({
      mimeType: "image/jpeg",
      base64: await toBase64(best),
      bytes: best.size,
    });
  }

  // The worker holds the whole document until its loading task is dropped.
  await document_.loadingTask.destroy();

  const totalBytes = pages.reduce((sum, page) => sum + page.bytes, 0);
  return {
    pages,
    totalBytes,
    skippedPages: Math.max(0, documentPages - pageCount),
    stillTooBig: stillTooBig || totalBytes > budgetBytes,
  };
}
