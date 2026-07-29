/* ---------------------------------------------------------------------------
   Theme switching.

   The palette swap is instant by design: no view transition, no cross-fade on
   <body>. Flipping the `dark` class on <html> is the whole operation.
--------------------------------------------------------------------------- */

export const THEME_STORAGE_KEY = "nowlny_theme";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => {
    ready: Promise<void>;
    finished: Promise<void>;
  };
};

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The single source of truth for what "dark mode is on" means in the DOM. */
export function applyThemeClass(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
}

/**
 * A plain cross-fade, used when the language flips. Switching to Arabic
 * re-lays the entire page out right-to-left; without this every element jumps
 * to its mirrored position in a single frame.
 */
export function runCrossFadeTransition(apply: () => void) {
  const doc = document as ViewTransitionDocument;
  if (typeof doc.startViewTransition !== "function" || prefersReducedMotion()) {
    apply();
    return;
  }
  doc.startViewTransition(apply);
}
