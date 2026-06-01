import React, { useState, useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { RestaurantResponse, Story } from "../../services/restaurants";

interface StoriesViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurant: RestaurantResponse | null;
}

const STORY_DURATION = 5000; // 5 seconds for images

export default function StoriesViewerModal({
  isOpen,
  onClose,
  restaurant,
}: StoriesViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  const stories = restaurant?.stories || [];
  const currentStory = stories[currentIndex];
  
  // Check if current story is a video
  const isVideo = !!currentStory?.imageUrl?.match(/\.(mp4|webm|mov|ogg)$/i);

  useEffect(() => {
    if (!isOpen) {
      setCurrentIndex(0);
      setProgress(0);
      setIsPaused(false);
      return;
    }
    
    if (stories.length === 0) {
      onClose();
    }
  }, [isOpen, stories.length, onClose]);

  useEffect(() => {
    setProgress(0);
    lastUpdateRef.current = Date.now();
    
    if (isVideo && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(e => console.log("Auto-play prevented", e));
    }
  }, [currentIndex, isVideo, isOpen]);

  useEffect(() => {
    if (!isOpen || stories.length === 0 || isPaused) {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (isVideo && videoRef.current) videoRef.current.pause();
      return;
    }

    if (isVideo && videoRef.current) {
      videoRef.current.play().catch(e => console.log("Auto-play prevented", e));
      // Video progress is handled by onTimeUpdate event on the video element
    } else {
      // Image progress
      progressTimerRef.current = setInterval(() => {
        const now = Date.now();
        const delta = now - lastUpdateRef.current;
        lastUpdateRef.current = now;
        
        setProgress(prev => {
          const next = prev + (delta / STORY_DURATION) * 100;
          if (next >= 100) {
            handleNext();
            return 100;
          }
          return next;
        });
      }, 50);
    }

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isOpen, currentIndex, isPaused, isVideo, stories.length]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else {
      setProgress(0);
      lastUpdateRef.current = Date.now();
      if (isVideo && videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
      }
    }
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current && !isPaused) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p || 0);
    }
  };

  const handleVideoEnded = () => {
    handleNext();
  };

  const timeSince = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    return `${Math.floor(diffInHours / 24)}d`;
  };

  if (!isOpen || !restaurant || stories.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md">
      {/* Desktop Close Button */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 text-white/70 hover:text-white p-2 hidden md:block z-50 transition-colors"
      >
        <X className="w-8 h-8" />
      </button>

      {/* Mute/Unmute Button (for videos) */}
      {isVideo && (
        <button 
          onClick={() => setIsMuted(!isMuted)}
          className="absolute top-6 left-6 text-white/70 hover:text-white p-2 z-50 transition-colors bg-black/40 rounded-full backdrop-blur-md"
        >
          {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
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
        <div className="absolute top-6 left-0 right-0 z-20 flex items-center justify-between px-4 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center shadow-lg">
              {restaurant.logo && restaurant.logo.length > 5 ? (
                <img src={restaurant.logo} alt={restaurant.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm">🍽️</span>
              )}
            </div>
            <div className="flex flex-col drop-shadow-md">
              <span className="text-white font-bold text-sm leading-tight tracking-tight">{restaurant.name}</span>
              <span className="text-white/70 text-xs font-medium">{timeSince(currentStory.createdAt)}</span>
            </div>
          </div>
          
          <button onClick={onClose} className="md:hidden text-white/80 p-1 drop-shadow-md">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div 
          className="relative flex-1 w-full h-full bg-black flex items-center justify-center cursor-pointer select-none group"
          onPointerDown={() => setIsPaused(true)}
          onPointerUp={() => setIsPaused(false)}
          onPointerLeave={() => setIsPaused(false)}
        >
          {isVideo ? (
            <video
              key={currentStory.imageUrl}
              ref={videoRef}
              src={currentStory.imageUrl}
              className="w-full h-full object-contain"
              playsInline
              autoPlay
              muted={isMuted}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleVideoEnded}
            />
          ) : (
            <img 
              key={currentStory.imageUrl}
              src={currentStory.imageUrl} 
              alt="Story" 
              className="w-full h-full object-contain"
            />
          )}

          {/* Tap Zones */}
          <div 
            className="absolute top-0 bottom-0 left-0 w-1/3 z-10" 
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
          >
            {/* Optional subtle hover hints for desktop */}
            <div className="w-full h-full opacity-0 group-hover:opacity-100 flex items-center pl-4 transition-opacity hidden md:flex">
              <div className="bg-black/20 backdrop-blur-sm p-2 rounded-full text-white/50 hover:text-white transition-colors">
                <ChevronLeft className="w-8 h-8" />
              </div>
            </div>
          </div>
          
          <div 
            className="absolute top-0 bottom-0 right-0 w-2/3 z-10" 
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
          >
             <div className="w-full h-full opacity-0 group-hover:opacity-100 flex items-center justify-end pr-4 transition-opacity hidden md:flex">
              <div className="bg-black/20 backdrop-blur-sm p-2 rounded-full text-white/50 hover:text-white transition-colors">
                <ChevronRight className="w-8 h-8" />
              </div>
            </div>
          </div>

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
