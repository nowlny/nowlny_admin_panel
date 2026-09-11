"use client";

import React, { useId, useRef, useState } from "react";
import { ImageOff, Link2, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useI18n } from "../../../lib/i18n";

/* ---------------------------------------------------------------------------
   Image picker.

   Photos used to be settable only by pasting a URL that was hosted somewhere
   else, which meant an operator with a picture on their laptop had no way to
   attach it. This takes a file from the local machine — dropped, browsed, or
   pasted from the clipboard — hands it to `upload`, and stores the hosted URL
   it returns. Pasting a URL still works, behind a toggle.
--------------------------------------------------------------------------- */

export interface ImagePickerProps {
  /** Current image URL ("" when unset). */
  value: string;
  onChange: (url: string) => void;
  /** Sends the file to the API and resolves with its hosted URL. */
  upload: (file: File) => Promise<string>;
  /** Client-side guard; return a message to reject the file, or null to accept. */
  validate?: (file: File) => string | null;
  /** `accept` attribute for the file input. */
  accept?: string;
  /** Overrides the generic "Photo" heading. */
  label?: string;
  /** Overrides the generic size/format line. */
  hint?: string;
  disabled?: boolean;
  /** Raised when an upload starts and finishes, so a form can block submit. */
  onUploadingChange?: (isUploading: boolean) => void;
}

export default function ImagePicker({
  value,
  onChange,
  upload,
  validate,
  accept = "image/*",
  label,
  hint,
  disabled = false,
  onUploadingChange,
}: ImagePickerProps) {
  const { t } = useI18n();
  const fieldId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrlField, setShowUrlField] = useState(false);
  // Keyed by URL rather than a boolean, so picking a new photo clears the
  // "didn't load" state without an effect that re-renders on every change.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const previewFailed = !!value && failedUrl === value;

  // dragenter/dragleave fire for every child element, so a plain boolean
  // flickers the highlight off as soon as the pointer crosses the icon.
  const dragDepth = useRef(0);

  const setUploading = (next: boolean) => {
    setIsUploading(next);
    onUploadingChange?.(next);
  };

  const handleFile = async (file: File) => {
    const message = validate?.(file);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const url = await upload(file);
      onChange(url);
      setShowUrlField(false);
    } catch (err: any) {
      setError(err?.message || t("image.upload_failed"));
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so re-picking the same file after an error fires onChange again.
    e.target.value = "";
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragActive(false);
    if (disabled || isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  /** Ctrl/Cmd-V of a screenshot straight into the focused drop zone. */
  const handlePaste = (e: React.ClipboardEvent) => {
    if (disabled || isUploading) return;
    const file = Array.from(e.clipboardData.files)[0];
    if (file) {
      e.preventDefault();
      handleFile(file);
    }
  };

  const openPicker = () => {
    if (!disabled && !isUploading) inputRef.current?.click();
  };

  const isBusy = disabled || isUploading;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={`${fieldId}-file`}
          className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide block"
        >
          {label ?? t("image.label")}
        </label>
        <button
          type="button"
          onClick={() => setShowUrlField((prev) => !prev)}
          aria-expanded={showUrlField}
          className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 hover:text-orange-500 inline-flex items-center gap-1 transition-colors"
        >
          <Link2 className="w-3 h-3" />
          {showUrlField ? t("image.hide_url") : t("image.use_url")}
        </button>
      </div>

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current += 1;
          if (!isBusy) setIsDragActive(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setIsDragActive(false);
        }}
        onDrop={handleDrop}
        onPaste={handlePaste}
        className={`relative flex items-center gap-4 rounded-xl border-2 border-dashed p-3 transition-colors ${
          isDragActive
            ? "border-orange-500 bg-orange-500/5"
            : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/20"
        }`}
      >
        {/* Preview */}
        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-zinc-200 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
          {value && !previewFailed ? (
            <img
              src={value}
              alt=""
              onError={() => setFailedUrl(value)}
              className="w-full h-full object-cover"
            />
          ) : previewFailed ? (
            <ImageOff className="w-5 h-5 text-zinc-400" aria-hidden />
          ) : (
            <span className="text-2xl" aria-hidden>
              🍲
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
            {t("image.drop_prompt")}{" "}
            <button
              type="button"
              onClick={openPicker}
              disabled={isBusy}
              className="text-orange-500 font-bold hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {t("image.browse")}
            </button>
            .
          </p>
          <p className="text-[10px] text-zinc-400">
            {previewFailed && value
              ? t("image.preview_failed")
              : (hint ?? t("image.hint"))}
          </p>

          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={openPicker}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-700 dark:text-zinc-300 font-bold text-[10px] px-3 py-1.5 rounded-lg shadow-sm transition-all"
            >
              {isUploading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <UploadCloud className="w-3 h-3" />
              )}
              {isUploading
                ? t("image.uploading")
                : value
                  ? t("image.replace_cta")
                  : t("image.upload_cta")}
            </button>

            {value && !isUploading && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setError(null);
                }}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-red-500 disabled:opacity-50 font-bold text-[10px] px-2 py-1.5 rounded-lg transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                {t("image.remove")}
              </button>
            )}
          </div>
        </div>

        <input
          id={`${fieldId}-file`}
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          disabled={isBusy}
          className="sr-only"
        />
      </div>

      {error && (
        <p role="alert" className="text-[10px] font-bold text-red-500">
          {error}
        </p>
      )}

      {showUrlField && (
        <div className="space-y-1 pt-1">
          <label
            htmlFor={`${fieldId}-url`}
            className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide block"
          >
            {t("image.url_label")}
          </label>
          <input
            id={`${fieldId}-url`}
            type="url"
            inputMode="url"
            placeholder="https://..."
            value={value}
            disabled={isBusy}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-200 text-zinc-850 placeholder-zinc-400 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200"
          />
        </div>
      )}
    </div>
  );
}
