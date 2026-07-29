"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { useI18n } from "../../../lib/i18n";
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Stack of open modals, innermost last.
 *
 * Every open Modal binds a `keydown` listener to `document`. Listeners on the
 * same node all fire regardless of `stopPropagation`, so without this a
 * ConfirmDialog opened on top of a form modal would close BOTH on one Escape.
 * Only the modal on top of the stack acts.
 */
const modalStack: symbol[] = [];

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** Rendered under the title in smaller muted text. */
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Sticky footer — typically the Cancel / Submit pair. */
  footer?: React.ReactNode;
  /** Tailwind max-width class for the panel. */
  maxWidth?: string;
  /**
   * Set false for forms with unsaved input, so a stray backdrop click or
   * Escape press cannot discard typing.
   */
  dismissable?: boolean;
  /** Icon shown to the left of the title. */
  icon?: React.ReactNode;
}

/**
 * Accessible dialog shell.
 *
 * Every modal in this app used to be a bare `<div className="fixed inset-0">`:
 * no `role="dialog"`, no Escape handler, no focus trap, no scroll lock, and no
 * internal scrolling — so on a short viewport the submit button was simply
 * unreachable. This centralises all of that.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "max-w-lg",
  dismissable = true,
  icon,
}: ModalProps) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [instanceId] = useState(() => Symbol("modal"));
  const titleId = useId();
  const descriptionId = useId();

  const requestClose = useCallback(() => {
    if (dismissable) onClose();
  }, [dismissable, onClose]);

  // Lock body scroll, trap focus, and restore focus on close.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    modalStack.push(instanceId);
    const isTopmost = () => modalStack[modalStack.length - 1] === instanceId;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the first meaningful control rather than the close button.
    const panel = panelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>(FOCUSABLE);
    const firstField = Array.from(focusables ?? []).find(
      (el) => el.dataset.modalClose !== "true",
    );
    (firstField ?? panel)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopmost()) return;

      if (event.key === "Escape") {
        requestClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const index = modalStack.indexOf(instanceId);
      if (index !== -1) modalStack.splice(index, 1);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen, requestClose, instanceId]);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`w-full ${maxWidth} max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl outline-none animate-in fade-in zoom-in-95 duration-200`}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            {icon}
            <div className="min-w-0">
              <h3
                id={titleId}
                className="text-base font-bold text-zinc-900 dark:text-white tracking-tight truncate"
              >
                {title}
              </h3>
              {description && (
                <p
                  id={descriptionId}
                  className="text-xs text-zinc-500 dark:text-zinc-400 mt-1"
                >
                  {description}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            data-modal-close="true"
            onClick={onClose}
            aria-label={t("modal.close")}
            className="p-2 -m-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto grow">{children}</div>

        {footer && (
          <div className="p-5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
