"use client";

/**
 * Reading a PDF's own text, in the browser, with no model involved.
 *
 * Most restaurant menu PDFs are not scans — they are exported from a design
 * tool and carry a real text layer, with every dish and price already in the
 * file as characters. Sending those to a vision model is paying an API to
 * guess at pixels for text we could simply read: slower, less accurate, and
 * gated behind a key.
 *
 * So this pulls the text out directly, keeping the geometry that makes a menu
 * readable — where a line sits, how big its type is, and where the gaps fall —
 * because that geometry is what tells a heading from a dish and a dish from
 * its price.
 */

export interface TextLine {
  /** The line's text, its runs joined in reading order. */
  text: string;
  /** 1-based page it came from. */
  page: number;
  /** Distance down the page, in PDF points. */
  y: number;
  /** Left edge of the first run. */
  x: number;
  /** Right edge of the last run. */
  right: number;
  /** Median height of the line's runs — a heading sets this higher. */
  fontSize: number;
  /** True when every run is a bold face. */
  bold: boolean;
}

/** Runs closer together than this vertically are the same line. */
const LINE_TOLERANCE = 3;

/** Past this a document is a brochure, and reading it all is not the job. */
const MAX_PAGES = 40;

interface Run {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  bold: boolean;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Every line of text in `file`, in reading order.
 *
 * Returns an empty array for a scanned PDF — there is no text layer to read,
 * which is exactly the signal the caller needs to fall back to OCR.
 */
export async function extractPdfLines(file: File): Promise<TextLine[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const document_ = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    disableAutoFetch: true,
  }).promise;

  const lines: TextLine[] = [];
  const pageCount = Math.min(document_.numPages, MAX_PAGES);

  for (let number = 1; number <= pageCount; number += 1) {
    const page = await document_.getPage(number);
    const content = await page.getTextContent();
    const styles = (content as { styles?: Record<string, { fontFamily?: string }> })
      .styles ?? {};

    const runs: Run[] = [];
    for (const item of content.items) {
      const run = item as {
        str?: unknown;
        transform?: number[];
        width?: number;
        height?: number;
        fontName?: string;
      };
      const text = typeof run.str === "string" ? run.str : "";
      if (!text.trim()) continue;

      const transform = run.transform ?? [];
      // Both, because they disagree: `styles` reports a generic family
      // ("sans-serif") for a standard font, and only the raw font name says
      // Helvetica-Bold. Weight is a bonus signal anyway — type size is what
      // actually separates a heading from a dish.
      const fontFamily = `${styles[run.fontName ?? ""]?.fontFamily ?? ""} ${
        run.fontName ?? ""
      }`;

      runs.push({
        text,
        x: Number(transform[4]) || 0,
        // PDF y grows upward; flipping it here means "sort ascending" is
        // "read top to bottom" everywhere downstream.
        y: -(Number(transform[5]) || 0),
        width: Number(run.width) || 0,
        height: Number(run.height) || Math.abs(Number(transform[3])) || 0,
        bold: /bold|black|heavy/i.test(String(fontFamily)),
      });
    }

    // Group runs into lines by vertical position, then read each left to right.
    runs.sort((a, b) => a.y - b.y || a.x - b.x);

    let current: Run[] = [];
    const flush = () => {
      if (current.length === 0) return;
      const ordered = [...current].sort((a, b) => a.x - b.x);

      // A wide gap between runs is a column break — the dot leader between a
      // dish and its price, or a second column of the menu. Marked with a tab
      // so the parser can see it; collapsed whitespace would hide it.
      let text = "";
      let previousEnd: number | null = null;
      for (const run of ordered) {
        if (previousEnd !== null) {
          const gap = run.x - previousEnd;
          const size = run.height || 10;
          if (gap > size * 1.2) text += "\t";
          else if (gap > size * 0.12) text += " ";
        }
        text += run.text;
        previousEnd = run.x + run.width;
      }

      lines.push({
        text: text.replace(/ {2,}/g, " ").trim(),
        page: number,
        y: ordered[0].y,
        x: ordered[0].x,
        right: previousEnd ?? ordered[0].x,
        fontSize: median(ordered.map((run) => run.height)),
        bold: ordered.every((run) => run.bold),
      });
      current = [];
    };

    for (const run of runs) {
      if (current.length > 0 && Math.abs(run.y - current[0].y) > LINE_TOLERANCE) {
        flush();
      }
      current.push(run);
    }
    flush();

    page.cleanup();
  }

  await document_.loadingTask.destroy();
  return lines.filter((line) => line.text !== "");
}
