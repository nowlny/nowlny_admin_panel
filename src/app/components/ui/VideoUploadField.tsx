"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Loader2, Trash2, Upload, VideoIcon } from "lucide-react";
import {
  ImageUploadError,
  isHostedImage,
  MAX_VIDEO_BYTES,
  megabytes,
  uploadVideo,
  uploadVideoFromUrl,
  videoPosterUrl,
} from "../../../lib/cloudinary";
import { isInstagramLink } from "../../../lib/instagram";
import { useI18n } from "../../../lib/i18n";

/**
 * Gets a reel's video onto our CDN from wherever the operator has it: a file
 * on their computer (picked or dropped), a direct video link, or an Instagram
 * reel link — which is a web page, not a video, so `/api/instagram-reel`
 * finds the clip behind it and copies it over.
 *
 * Whatever the source, what ends up in `value` is a `res.cloudinary.com` URL;
 * a pasted link is a source to copy from, not the thing to store.
 */
export interface ImportedReelDetails {
  thumbnailUrl?: string | null;
  caption?: string | null;
}

export interface VideoUploadFieldProps {
  id: string;
  label: string;
  /** The hosted video URL; `""` when nothing is set. */
  value: string;
  onChange: (url: string) => void;
  /** Extras that came with the video — a cover frame, an Instagram caption. */
  onImported?: (details: ImportedReelDetails) => void;
  /** Raised while an upload is in flight so the form can block submission. */
  onUploadingChange?: (isUploading: boolean) => void;
  /** A validation message from the form, shown in place of the hint. */
  error?: string;
  inputClassName: string;
  labelClassName: string;
}

const BUTTON_CLASS =
  "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

type Busy = null | { kind: "file"; progress: number } | { kind: "link" } | { kind: "instagram" };

export default function VideoUploadField({
  id,
  label,
  value,
  onChange,
  onImported,
  onUploadingChange,
  error: fieldError,
  inputClassName,
  labelClassName,
}: VideoUploadFieldProps) {
  const { t } = useI18n();
  const hintId = `${useId()}-hint`;
  const fileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // See ImageUploadField: paste focuses, then disabling the box blurs it, and
  // without this the blur would restart the fetch the paste just started.
  const pendingUrlRef = useRef<string | null>(null);
  const [busy, setBusyState] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
    setPreviewFailed(false);
  }

  useEffect(() => () => abortRef.current?.abort(), []);

  const setBusy = (next: Busy) => {
    setBusyState(next);
    onUploadingChange?.(next !== null);
  };

  /** Starts a new job, cancelling whatever was running. */
  const begin = (next: Busy, pendingUrl: string | null = null) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    pendingUrlRef.current = pendingUrl;
    setError(null);
    setBusy(next);
    return controller;
  };

  const finish = (controller: AbortController) => {
    if (abortRef.current !== controller) return;
    abortRef.current = null;
    pendingUrlRef.current = null;
    setBusy(null);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const controller = begin({ kind: "file", progress: 0 });
    try {
      const url = await uploadVideo(file, {
        signal: controller.signal,
        onProgress: (progress) => {
          if (abortRef.current === controller) setBusyState({ kind: "file", progress });
        },
      });
      onChange(url);
      onImported?.({ thumbnailUrl: videoPosterUrl(url) });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof ImageUploadError && err.reason === "type") {
        setError(t("video_upload.invalid_type"));
      } else if (err instanceof ImageUploadError && err.reason === "size") {
        setError(
          t("video_upload.too_large", {
            size: megabytes(file.size),
            limit: megabytes(MAX_VIDEO_BYTES),
          }),
        );
      } else {
        console.error("Video upload failed", err);
        setError(t("video_upload.failed"));
      }
    } finally {
      finish(controller);
    }
  };

  const importInstagram = async (link: string) => {
    const controller = begin({ kind: "instagram" }, link);
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const response = await fetch("/api/instagram-reel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: link }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.videoUrl) {
        setError(payload?.error || t("video_upload.instagram_failed"));
        return;
      }
      onChange(payload.videoUrl);
      onImported?.({ thumbnailUrl: payload.thumbnailUrl, caption: payload.caption });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Instagram import failed", err);
      setError(t("video_upload.instagram_failed"));
    } finally {
      finish(controller);
    }
  };

  const copyLink = async (link: string) => {
    const controller = begin({ kind: "link" }, link);
    try {
      const url = await uploadVideoFromUrl(link, { signal: controller.signal });
      onChange(url);
      onImported?.({ thumbnailUrl: videoPosterUrl(url) });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      // Keep the link so the operator isn't left with nothing — it may still
      // play, it just isn't ours.
      console.error("Video link could not be re-hosted", err);
      setError(t("video_upload.link_failed"));
      onChange(link);
    } finally {
      finish(controller);
    }
  };

  const commitUrl = (raw: string, { force = false } = {}) => {
    const candidate = raw.trim();
    if (!candidate || isHostedImage(candidate) || !/^https?:\/\//i.test(candidate)) {
      setError(null);
      if (candidate !== value) onChange(candidate);
      return;
    }
    if (candidate === pendingUrlRef.current) return;
    if (candidate === value && !force) return;

    if (isInstagramLink(candidate)) void importInstagram(candidate);
    else void copyLink(candidate);
  };

  const handleRemove = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    pendingUrlRef.current = null;
    setBusy(null);
    setError(null);
    setDraft("");
    onChange("");
  };

  const isBusy = busy !== null;
  const busyLabel =
    busy?.kind === "file"
      ? t("video_upload.uploading", { percent: Math.round(busy.progress * 100) })
      : busy?.kind === "instagram"
        ? t("video_upload.importing_instagram")
        : busy?.kind === "link"
          ? t("video_upload.copying_link")
          : "";
  const shownError = error || fieldError;

  return (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setIsDragging(false);
        if (!isBusy) void handleFile(e.dataTransfer.files[0]);
      }}
      className={`rounded-xl transition-colors ${
        isDragging ? "ring-2 ring-orange-500/60 bg-orange-500/5" : ""
      }`}
    >
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>

      <div className="flex items-start gap-3">
        <div className="relative w-24 aspect-[9/16] shrink-0 overflow-hidden rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60">
          {value && !previewFailed ? (
            <video
              key={value}
              src={value}
              controls
              playsInline
              preload="metadata"
              onError={() => setPreviewFailed(true)}
              className="w-full h-full bg-black object-contain"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-zinc-400 dark:text-zinc-600">
              <VideoIcon className="w-6 h-6" />
            </span>
          )}
          {isBusy && (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/80 dark:bg-zinc-900/80">
              <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
              {busy?.kind === "file" && (
                <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-200">
                  {Math.round(busy.progress * 100)}%
                </span>
              )}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isBusy}
              className={BUTTON_CLASS}
            >
              <Upload className="w-3.5 h-3.5" />
              {value ? t("video_upload.replace") : t("video_upload.choose")}
            </button>
            {value && !isBusy && (
              <button type="button" onClick={handleRemove} className={BUTTON_CLASS}>
                <Trash2 className="w-3.5 h-3.5" />
                {t("common.remove")}
              </button>
            )}
            {isBusy && busy?.kind !== "file" && (
              <button type="button" onClick={handleRemove} className={BUTTON_CLASS}>
                {t("common.cancel")}
              </button>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            className="sr-only"
            tabIndex={-1}
            disabled={isBusy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Clear so re-picking the same file still fires `change`.
              e.target.value = "";
              void handleFile(file);
            }}
          />

          <input
            ref={urlRef}
            id={id}
            type="url"
            inputMode="url"
            placeholder={t("video_upload.url_placeholder")}
            value={draft}
            disabled={isBusy}
            aria-invalid={!!shownError}
            aria-describedby={hintId}
            onChange={(e) => {
              setError(null);
              setDraft(e.target.value);
            }}
            onPaste={() => {
              window.setTimeout(
                () => commitUrl(urlRef.current?.value ?? "", { force: true }),
                0,
              );
            }}
            onBlur={(e) => commitUrl(e.target.value)}
            onKeyDown={(e) => {
              // Enter would submit the whole reel form with the raw link in it.
              if (e.key === "Enter") {
                e.preventDefault();
                commitUrl(e.currentTarget.value, { force: true });
              }
            }}
            className={inputClassName}
          />

          <p
            id={hintId}
            role={shownError ? "alert" : undefined}
            className={`text-[11px] font-medium leading-relaxed ${
              shownError
                ? "text-red-500"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {isBusy
              ? busyLabel
              : shownError ||
                (value && previewFailed
                  ? t("reels.preview_failed")
                  : t("video_upload.hint", { limit: megabytes(MAX_VIDEO_BYTES) }))}
          </p>
        </div>
      </div>
    </div>
  );
}
