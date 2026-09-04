"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import {
  ImageUploadError,
  MAX_IMAGE_BYTES,
  megabytes,
  uploadImage,
} from "../../../lib/cloudinary";
import { useI18n } from "../../../lib/i18n";

/**
 * Picks an image, uploads it, and hands back the hosted URL.
 *
 * The field the API wants is still a URL, so the text input stays — an operator
 * copying artwork from an existing listing shouldn't be forced to download it
 * first. What changes is that the common case (a file on the operator's
 * machine) no longer requires them to host it somewhere themselves.
 */
export interface ImageUploadFieldProps {
  label: string;
  /** The hosted image URL; `""` when nothing is set. */
  value: string;
  onChange: (url: string) => void;
  /** Raised while an upload is in flight so the form can block submission. */
  onUploadingChange?: (isUploading: boolean) => void;
  disabled?: boolean;
  /** Preview shape — a logo is square, a cover is wide. */
  aspect?: "square" | "wide";
  className?: string;
}

const FIELD_CLASS =
  "w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors";
const LABEL_CLASS = "text-xs font-semibold text-zinc-700 dark:text-zinc-300";
const BUTTON_CLASS =
  "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

export default function ImageUploadField({
  label,
  value,
  onChange,
  onUploadingChange,
  disabled = false,
  aspect = "square",
  className = "",
}: ImageUploadFieldProps) {
  const { t } = useI18n();
  const reactId = useId();
  const inputId = `image-upload-${reactId}`;
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A modal closed mid-upload would otherwise resolve into an unmounted tree.
  useEffect(() => () => abortRef.current?.abort(), []);

  const setUploading = (next: boolean) => {
    setIsUploading(next);
    onUploadingChange?.(next);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear immediately so re-picking the same file still fires `change`.
    e.target.value = "";
    if (!file) return;

    setError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setUploading(true);
    try {
      const url = await uploadImage(file, { signal: controller.signal });
      onChange(url);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof ImageUploadError && err.reason === "type") {
        setError(t("upload.invalid_type"));
      } else if (err instanceof ImageUploadError && err.reason === "size") {
        setError(
          t("upload.too_large", {
            size: megabytes(file.size),
            limit: megabytes(MAX_IMAGE_BYTES),
          }),
        );
      } else {
        console.error("Image upload failed", err);
        setError(t("upload.failed"));
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setUploading(false);
      }
    }
  };

  const handleRemove = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setUploading(false);
    setError(null);
    onChange("");
  };

  const busy = disabled || isUploading;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={inputId} className={LABEL_CLASS}>
        {label}
      </label>

      <div className="flex items-start gap-3">
        <div
          className={`relative shrink-0 overflow-hidden rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 ${
            aspect === "wide" ? "w-32 h-16" : "w-16 h-16"
          }`}
        >
          {value ? (
            <img
              src={value}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-zinc-400 dark:text-zinc-600">
              <ImageIcon className="w-5 h-5" />
            </span>
          )}
          {isUploading && (
            <span className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-zinc-900/70">
              <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className={BUTTON_CLASS}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {t("upload.uploading")}
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  {value ? t("upload.replace") : t("upload.choose")}
                </>
              )}
            </button>
            {value && !isUploading && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled}
                className={BUTTON_CLASS}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t("common.remove")}
              </button>
            )}
          </div>

          <input
            ref={fileRef}
            id={inputId}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={handleFile}
          />

          <input
            type="url"
            inputMode="url"
            placeholder={t("upload.url_placeholder")}
            aria-label={t("upload.url_label", { field: label })}
            value={value}
            disabled={busy}
            onChange={(e) => {
              setError(null);
              onChange(e.target.value);
            }}
            className={FIELD_CLASS}
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-[10px] text-red-500">
          {error}
        </p>
      ) : (
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
          {t("upload.hint", { limit: megabytes(MAX_IMAGE_BYTES) })}
        </p>
      )}
    </div>
  );
}
