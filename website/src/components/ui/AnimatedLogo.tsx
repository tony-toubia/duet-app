'use client';

import { useRef, useEffect } from 'react';

interface AnimatedLogoProps {
  size?: number;
  loop?: boolean;
  onComplete?: () => void;
}

export function AnimatedLogo({ size = 120, loop = false, onComplete }: AnimatedLogoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      onComplete?.();
    };

    video.addEventListener('ended', handleEnded);

    // Auto-play (muted videos don't need user interaction)
    video.play().catch(() => {
      // If autoplay fails, call onComplete so we don't block
      onComplete?.();
    });

    return () => {
      video.removeEventListener('ended', handleEnded);
    };
  }, [onComplete]);

  return (
    <video
      ref={videoRef}
      src="/duet-logo-animated.mp4"
      width={size}
      height={size}
      muted
      playsInline
      loop={loop}
      className="object-contain"
      style={{ background: 'transparent' }}
    />
  );
}
