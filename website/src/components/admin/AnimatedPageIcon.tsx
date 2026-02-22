'use client';

import { useRef, useEffect, useState } from 'react';

interface AnimatedPageIconProps {
  name: string;
}

/**
 * Plays the animated MP4 icon once on mount, then freezes on the last frame.
 * Falls back to a static PNG if no MP4 is available.
 */
export function AnimatedPageIcon({ name }: AnimatedPageIconProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    setUseFallback(false);
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.play().catch(() => {});
  }, [name]);

  if (useFallback) {
    return (
      <span className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/icons/${name}.png`} alt="" className="w-8 h-8 object-contain" />
      </span>
    );
  }

  return (
    <span className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white">
      <video
        ref={videoRef}
        src={`/icons/${name}.mp4`}
        muted
        playsInline
        autoPlay
        className="w-8 h-8 object-contain"
        onError={() => setUseFallback(true)}
      />
    </span>
  );
}
