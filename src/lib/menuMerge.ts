/**
 * Merging the parts of a menu that was scanned in several passes.
 *
 * A twelve-page menu cannot be read in one request: the platform stops a
 * serverless function at 60 seconds, and no amount of patience on the client
 * changes that. So the pages are scanned a few at a time and the answers are
 * stitched back together here.
 *
 * The seam is the interesting part. The same category appears in two
 * consecutive batches whenever a section runs across a page break, and the
 * same dish can be read twice with different luck — a price in one pass, a
 * description in the other. Neither should reach the operator as a duplicate.
 */

export interface ScannedItem {
  name: string;
  description?: string;
  price: number;
  image?: string;
  imageQuery?: string;
  isAvailable?: boolean;
  optionGroups?: unknown[];
}

export interface ScannedCategory {
  name: string;
  items: ScannedItem[];
}

export interface ScannedMenu {
  language?: string;
  label?: string;
  categories: ScannedCategory[];
}

/** Names differ by case and stray spaces between passes; ours must not. */
const key = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Fold a later reading of the same dish into the one already kept.
 *
 * The first pass wins on anything it actually has; the second fills the gaps.
 * A price of 0 counts as a gap — that is what the scanner returns when it
 * could not find one, and a real price from the other pass is strictly better.
 */
function enrich(kept: ScannedItem, later: ScannedItem): void {
  if (!kept.description && later.description) kept.description = later.description;
  if (!kept.image && later.image) kept.image = later.image;
  if (!kept.imageQuery && later.imageQuery) kept.imageQuery = later.imageQuery;
  if (!(kept.price > 0) && later.price > 0) kept.price = later.price;
  if (!kept.optionGroups?.length && later.optionGroups?.length) {
    kept.optionGroups = later.optionGroups;
  }
  // Unavailable anywhere means unavailable: the stricter reading is safer.
  if (later.isAvailable === false) kept.isAvailable = false;
}

export function mergeScannedMenus(parts: ScannedMenu[]): ScannedMenu {
  const categories: ScannedCategory[] = [];
  const categoryIndex = new Map<string, number>();
  const itemIndex = new Map<string, Map<string, number>>();

  for (const part of parts) {
    for (const category of part?.categories ?? []) {
      const categoryKey = key(category.name ?? "");

      let position = categoryIndex.get(categoryKey);
      if (position === undefined) {
        position = categories.length;
        categoryIndex.set(categoryKey, position);
        categories.push({ name: category.name, items: [] });
        itemIndex.set(categoryKey, new Map());
      }

      const items = categories[position].items;
      const seen = itemIndex.get(categoryKey)!;

      for (const item of category.items ?? []) {
        const itemKey = key(item.name ?? "");
        if (!itemKey) continue;

        const existing = seen.get(itemKey);
        if (existing === undefined) {
          seen.set(itemKey, items.length);
          items.push({ ...item });
        } else {
          enrich(items[existing], item);
        }
      }
    }
  }

  return {
    // Whichever pass actually detected something; they are reading one menu.
    language: parts.find((part) => part?.language)?.language,
    label: parts.find((part) => part?.label)?.label,
    categories: categories.filter((category) => category.items.length > 0),
  };
}

export interface BatchProgress {
  /** 1-based page numbers this pass covers, and the document's total. */
  from: number;
  to: number;
  total: number;
  /** 0-based index of this pass, and how many there are. */
  index: number;
  count: number;
}

export interface BatchedScan {
  menu: ScannedMenu;
  /** Page ranges that failed, e.g. ["4-6"]. Empty when everything read. */
  failed: string[];
}

/**
 * Scan a long document a few pages at a time and stitch the answers together.
 *
 * Sequential on purpose: these requests are the expensive part of an import,
 * and firing them together would multiply the load on a rate-limited key by
 * the number of passes — the one thing most likely to fail the whole scan.
 *
 * A pass that fails is recorded, not thrown. Ten pages that read are worth
 * more than a clean failure over the two that did not, and the operator is
 * told which pages are missing so they can fill them in by hand.
 */
export async function scanInBatches<TPage>(
  pages: TPage[],
  batchSize: number,
  run: (batch: TPage[], progress: BatchProgress) => Promise<ScannedMenu>,
  onProgress?: (progress: BatchProgress) => void,
): Promise<BatchedScan> {
  const batches: TPage[][] = [];
  for (let start = 0; start < pages.length; start += Math.max(1, batchSize)) {
    batches.push(pages.slice(start, start + Math.max(1, batchSize)));
  }

  const parts: ScannedMenu[] = [];
  const failed: string[] = [];
  let cursor = 1;

  for (const [index, batch] of batches.entries()) {
    const progress: BatchProgress = {
      from: cursor,
      to: cursor + batch.length - 1,
      total: pages.length,
      index,
      count: batches.length,
    };
    cursor += batch.length;

    onProgress?.(progress);
    try {
      parts.push(await run(batch, progress));
    } catch (error) {
      console.warn(`Pages ${progress.from}-${progress.to} failed:`, error);
      failed.push(
        progress.from === progress.to
          ? `${progress.from}`
          : `${progress.from}-${progress.to}`,
      );
    }
  }

  return { menu: mergeScannedMenus(parts), failed };
}
