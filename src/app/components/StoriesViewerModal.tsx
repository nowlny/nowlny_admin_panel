"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Play,
  AlertTriangle,
} from "lucide-react";
import { RestaurantResponse } from "../../services/restaurants";

interface StoriesViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurant: RestaurantResponse | null;
}

const STORY_DURATION = 5000; // 5 seconds for images
/** A pointer press longer than this is a hold-to-pause, not a tap to navigate. */
const HOLD_MS = 250;
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogg|ogv)$/i;

const FOCUSABLE =
  "button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";

export default function StoriesViewerModal({
  isOpen,
  onClose,
  restaurant,
}: StoriesViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  /**
   * Muted by default. Every browser blocks autoplay *with sound*, so starting
   * unmuted meant `play()` rejected, the rejection was swallowed, and the story
   * sat on a black frame at 0% forever without ever advancing.
   */
  const [isMuted, setIsMuted] = useState(true);
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [treatAsVideo, setTreatAsVideo] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());
  const pressStartRef = useRef<number | null>(null);
  const advancedFromRef = useRef<number>(-1);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const stories = restaurant?.stories || [];
  const currentStory = stories[currentIndex];
  const mediaUrl = currentStory?.imageUrl ?? "";

  /**
   * Signed and CDN URLs carry a query string (`…/clip.mp4?token=abc`), so the
   * old anchored extension test classified real videos as images and rendered
   * them into an `<img>`. Strip the query/hash before testing, and fall back to
   * "it's probably a video" if the `<img>` decode fails.
   */
  const looksLikeVideo = VIDEO_EXTENSIONS.test(mediaUrl.split(/[?#]/)[0]);
  const renderVideo = !mediaError && (treatAsVideo || looksLikeVideo);
  /** Images *and* broken assets run on the timer, so a dead URL still advances. */
  const usesTimer = !renderVideo;

  /* ---------------------------------------------------------------------
     Navigation. `goTo` resets the progress bar in the SAME commit as the
     index, so the "advance at 100%" effect below can never observe a stale
     100% against a fresh story.
  --------------------------------------------------------------------- */
  const goTo = useCallback((index: number) => {
    advancedFromRef.current = -1;
    lastUpdateRef.current = Date.now();
    setCurrentIndex(index);
    setProgress(0);
  }, []);

  const handleNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      goTo(currentIndex + 1);
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, goTo, onClose]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      goTo(currentIndex - 1);
    } else {
      // Already on the first story — restart it.
      goTo(0);
      if (videoRef.current) videoRef.current.currentTime = 0;
    }
  }, [currentIndex, goTo]);

  // Callbacks are re-created on every index change; the keyboard/scroll-lock
  // effect must not tear down and re-run (and steal focus) each time.
  const latestRef = useRef({ handleNext, handlePrev, onClose });
  useEffect(() => {
    latestRef.current = { handleNext, handlePrev, onClose };
  });

  const tryPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const played = video.play();
    if (played && typeof played.then === "function") {
      played
        .then(() => setShowPlayButton(false))
        .catch(() => setShowPlayButton(true));
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setCurrentIndex(0);
      setProgress(0);
      setIsPaused(false);
      advancedFromRef.current = -1;
      return;
    }

    if (stories.length === 0) {
      latestRef.current.onClose();
    }
  }, [isOpen, stories.length]);

  // Per-story media reset. Deliberately does NOT touch `progress` — `goTo`
  // owns that, so the advance effect can't be tripped by effect ordering.
  useEffect(() => {
    setMediaError(false);
    setTreatAsVideo(false);
    setShowPlayButton(false);
  }, [currentIndex, mediaUrl]);

  useEffect(() => {
    if (!isOpen || stories.length === 0) return;

    if (isPaused) {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
      videoRef.current?.pause();
      return;
    }

    if (!usesTimer) {
      tryPlay();
      // Video progress comes from onTimeUpdate / onEnded.
      return;
    }

    lastUpdateRef.current = Date.now();
    progressTimerRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - lastUpdateRef.current;
      lastUpdateRef.current = now;
      // Pure updater. It used to call handleNext() from in here, which React 19
      // double-invokes in StrictMode — a tick landing on the 100% boundary could
      // skip two stories at once.
      setProgress((prev) => Math.min(100, prev + (delta / STORY_DURATION) * 100));
    }, 50);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    };
  }, [isOpen, currentIndex, isPaused, usesTimer, stories.length, tryPlay]);

  // Advancing lives here, outside the state updater.
  useEffect(() => {
    if (!isOpen || progress < 100) return;
    // Idempotence guard for StrictMode's double effect invocation.
    if (advancedFromRef.current === currentIndex) return;
    advancedFromRef.current = currentIndex;
    handleNext();
  }, [isOpen, progress, currentIndex, handleNext]);

  /* ---------------------------------------------------------------------
     Dialog semantics: scroll lock, focus move + restore, focus trap and a
     keyboard map. Previously this was a bare `fixed inset-0` div whose only
     navigation was two `<div onClick>` tap zones — unusable by keyboard.
  --------------------------------------------------------------------- */
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    containerRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      const { handleNext: next, handlePrev: prev, onClose: close } =
        latestRef.current;

      if (event.key === "Tab") {
        const items = Array.from(
          containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
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
        return;
      }

      switch (event.key) {
        case "Escape":
          event.preventDefault();
          close();
          break;
        case "ArrowRight":
        case " ":
          // preventDefault also stops Space from re-triggering a focused button.
          event.preventDefault();
          next();
          break;
        case "ArrowLeft":
          event.preventDefault();
          prev();
          break;
        case "m":
        case "M":
          setIsMuted((value) => !value);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen]);

  const handleVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || isPaused || !video.duration) return;
    // Clamped below 100 so only `onEnded` triggers the advance — otherwise a
    // final timeupdate and `ended` would both fire it.
    setProgress(Math.min(99.9, (video.currentTime / video.duration) * 100));
  };

  /** A tap navigates; a press-and-hold only pauses. */
  const zoneClick = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    const start = pressStartRef.current;
    pressStartRef.current = null;
    // `start === null` means keyboard activation — always navigate.
    if (start !== null && Date.now() - start > HOLD_MS) return;
    action();
  };

  const timeSince = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";
    const diffInSeconds = Math.max(
      0,
      Math.floor((Date.now() - date.getTime()) / 1000),
    );

    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    return `${Math.floor(diffInHours / 24)}d`;
  };

  if (!isOpen || !restaurant || stories.length === 0 || !currentStory)
    return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Stories from ${restaurant.name}`}
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md outline-none"
    >
      {/* Desktop Close Button */}
      <button
        onClick={onClose}
        aria-label="Close stories"
        className="absolute top-6 right-6 text-white/70 hover:text-white p-2 hidden md:block z-50 transition-colors"
      >
        <X className="w-8 h-8" />
      </button>

      {/* Mute/Unmute Button (for videos) */}
      {renderVideo && (
        <button
          onClick={() => setIsMuted(!isMuted)}
          aria-label={isMuted ? "Unmute story (M)" : "Mute story (M)"}
          className="absolute top-6 left-6 text-white/70 hover:text-white p-2 z-50 transition-colors bg-black/40 rounded-full backdrop-blur-md"
        >
          {isMuted ? (
            <VolumeX className="w-6 h-6" />
          ) : (
            <Volume2 className="w-6 h-6" />
          )}
        </button>
      )}

      {/* Main Container - Mobile sized on desktop */}
      <div className="relative w-full h-full md:w-[450px] md:h-[800px] md:max-h-[95vh] md:rounded-3xl bg-zinc-900 overflow-hidden flex flex-col shadow-2xl">

        {/* Progress Bars */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1.5 px-3 pt-4 pb-2 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          {stories.map((story, idx) => (
            <div key={story.id} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
              <div
                className="h-full bg-white transition-all duration-75 ease-linear"
                style={{
                  width: idx === currentIndex ? `${progress}%` : idx < currentIndex ? '100%' : '0%'
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-0 right-0 z-20 flex items-center justify-between px-4 mt-2 pointer-events-none">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center shadow-lg">
              {restaurant.logo && restaurant.logo.length > 5 ? (
                <img src={restaurant.logo} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm" aria-hidden="true">🍽️</span>
              )}
            </div>
            <div className="flex flex-col drop-shadow-md">
              <span className="text-white font-bold text-sm leading-tight tracking-tight">{restaurant.name}</span>
              <span className="text-white/70 text-xs font-medium">
                {timeSince(currentStory.createdAt)}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close stories"
            className="md:hidden text-white/80 p-2 drop-shadow-md pointer-events-auto"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div
          className="relative flex-1 w-full h-full bg-black flex items-center justify-center select-none group"
          onPointerDown={() => {
            pressStartRef.current = Date.now();
            setIsPaused(true);
          }}
          onPointerUp={() => setIsPaused(false)}
          onPointerLeave={() => {
            pressStartRef.current = null;
            setIsPaused(false);
          }}
        >
          {mediaError ? (
            <div className="flex flex-col items-center gap-2 text-white/70 px-8 text-center">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
              <p className="text-sm font-semibold">This story couldn&apos;t be loaded.</p>
              <p className="text-xs text-white/50">Skipping to the next one…</p>
            </div>
          ) : renderVideo ? (
            <video
              key={mediaUrl}
              ref={videoRef}
              src={mediaUrl}
              className="w-full h-full object-contain"
              playsInline
              autoPlay
              preload="metadata"
              muted={isMuted}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={() => setProgress(100)}
              onPlaying={() => setShowPlayButton(false)}
              onError={() => setMediaError(true)}
            />
          ) : (
            <img
              key={mediaUrl}
              src={mediaUrl}
              alt={currentStory.caption || "Story"}
              className="w-full h-full object-contain"
              onError={() => {
                // Extensionless CDN keys can still be video — try once before
                // giving up, instead of leaving a broken-image icon.
                if (!treatAsVideo) setTreatAsVideo(true);
                else setMediaError(true);
              }}
            />
          )}

          {/* Autoplay was blocked — give the operator a way to start playback. */}
          {renderVideo && showPlayButton && !mediaError && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                tryPlay();
              }}
              aria-label="Play story"
              className="absolute inset-0 z-20 flex items-center justify-center"
            >
              <span className="bg-white/90 text-zinc-900 rounded-full p-5 shadow-2xl flex items-center justify-center">
                <Play className="w-8 h-8 fill-current" />
              </span>
            </button>
          )}

          {/* Tap / click zones — real buttons so they're keyboard reachable. */}
          <button
            type="button"
            aria-label="Previous story"
            className="absolute top-0 bottom-0 left-0 w-1/3 z-10 cursor-pointer"
            onClick={zoneClick(handlePrev)}
          >
            {/* Optional subtle hover hints for desktop */}
            <span className="w-full h-full opacity-0 group-hover:opacity-100 items-center pl-4 transition-opacity hidden md:flex">
              <span className="bg-black/20 backdrop-blur-sm p-2 rounded-full text-white/50 hover:text-white transition-colors">
                <ChevronLeft className="w-8 h-8" />
              </span>
            </span>
          </button>

          <button
            type="button"
            aria-label="Next story"
            className="absolute top-0 bottom-0 right-0 w-2/3 z-10 cursor-pointer"
            onClick={zoneClick(handleNext)}
          >
            <span className="w-full h-full opacity-0 group-hover:opacity-100 items-center justify-end pr-4 transition-opacity hidden md:flex">
              <span className="bg-black/20 backdrop-blur-sm p-2 rounded-full text-white/50 hover:text-white transition-colors">
                <ChevronRight className="w-8 h-8" />
              </span>
            </span>
          </button>

          {/* Caption */}
          {currentStory.caption && (
            <div className="absolute bottom-8 left-4 right-4 z-20 text-center pointer-events-none">
              <span className="bg-black/60 backdrop-blur-md text-white text-sm font-medium px-4 py-2 rounded-xl inline-block max-w-full truncate shadow-xl">
                {currentStory.caption}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
