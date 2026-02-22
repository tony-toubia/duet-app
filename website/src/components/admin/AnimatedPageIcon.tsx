'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface AnimatedPageIconProps {
  name: string;
  size?: number;
}

/**
 * Plays the animated GIF once on mount, then swaps to the static PNG.
 * Displayed in a white rounded box next to page titles.
 */
export function AnimatedPageIcon({ name, size = 32 }: AnimatedPageIconProps) {
  const [showGif, setShowGif] = useState(true);

  useEffect(() => {
    // GIFs are typically 2-4 seconds; swap to static after 4s
    const timer = setTimeout(() => setShowGif(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <span className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white">
      <Image
        src={`/icons/${name}.${showGif ? 'gif' : 'png'}`}
        alt=""
        width={size}
        height={size}
        unoptimized
        className="w-8 h-8 object-contain"
      />
    </span>
  );
}
