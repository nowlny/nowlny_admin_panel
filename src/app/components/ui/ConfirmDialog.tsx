"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import Modal from "./Modal";

export interface ConfirmOptions {
  title: string;
  /** Body copy. Always name the specific record being acted on. */
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` renders a red primary button. Use for irreversible actions. */
  variant?: "danger" | "default";
  /**
   * When set, the confirm button stays disabled until the user types this
   * string exactly. Reserve for genuinely unrecoverable deletions.
   */
  confirmPhrase?: string;
}

type Resolver = (value: boolean) => void;

const ConfirmContext = createContext<
  ((options: ConfirmOptions) => Promise<boolean>) | null
>(null);

/**
 * Promise-based replacement for the browser's blocking `confirm()`.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Delete order?", variant: "danger" }))) return;
 *
 * The app had 37 native `confirm()`/`alert()` calls, which are unstyled,
 * unthemeable, block the JS thread, and are suppressed outright in some
 * embedded webviews — where `confirm()` returns false and the action simply
 * never happened, with no feedback.
 */
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used within a <ConfirmProvider>");
  }
  return confirm;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [phrase, setPhrase] = useState("");
  const resolverRef = useRef<Resolver | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    setPhrase("");
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
    setPhrase("");
  }, []);

  const isDanger = options?.variant === "danger";
  const phraseSatisfied =
    !options?.confirmPhrase || phrase.trim() === options.confirmPhrase;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        isOpen={options !== null}
        onClose={() => settle(false)}
        title={options?.title ?? ""}
        maxWidth="max-w-md"
        icon={
          isDanger ? (
            <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
          ) : undefined
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => settle(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              {options?.cancelLabel ?? "Cancel"}
            </button>
            <button
              type="button"
              onClick={() => settle(true)}
              disabled={!phraseSatisfied}
              className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                isDanger
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-orange-500 hover:bg-orange-600"
              }`}
            >
              {options?.confirmLabel ?? "Confirm"}
            </button>
          </>
        }
      >
        {options?.description && (
          <div className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {options.description}
          </div>
        )}
        {options?.confirmPhrase && (
          <div className="mt-4">
            <label
              htmlFor="confirm-phrase"
              className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5"
            >
              Type{" "}
              <span className="text-zinc-900 dark:text-white">
                {options.confirmPhrase}
              </span>{" "}
              to confirm
            </label>
            <input
              id="confirm-phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              autoComplete="off"
              className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

/** Small inline spinner for buttons mid-mutation. */
export function ButtonSpinner() {
  return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
}
