'use client';

import { useEffect, useRef } from 'react';

const GIF_DURATION_MS = 4010;

interface AnimatedLogoProps {
  size?: number;
  loop?: boolean;
  onComplete?: () => void;
}

export function AnimatedLogo({ size = 120, loop = false, onComplete }: AnimatedLogoProps) {
  const calledRef = useRef(false);

  useEffect(() => {
    if (loop || !onComplete) return;

    // GIF has no 'ended' event — fire onComplete after the known duration
    const timer = setTimeout(() => {
      if (!calledRef.current) {
        calledRef.current = true;
        onComplete();
      }
    }, GIF_DURATION_MS);

    return () => clearTimeout(timer);
  }, [loop, onComplete]);

  // For non-looping: load GIF with a cache-bust so it plays from frame 1 each mount.
  // For looping: GIFs loop by default in browsers.
  const src = loop ? '/duet-logo-animated.gif' : `/duet-logo-animated.gif?t=${Date.now()}`;

  return (
    <img
      src={src}
      alt="Duet"
      width={size}
      height={size}
      className="object-contain"
    />
  );
}
