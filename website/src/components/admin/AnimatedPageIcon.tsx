'use client';

import { useEffect, useRef } from 'react';

interface AnimatedPageIconProps {
  name: string;
}

/**
 * Plays the animated GIF once on mount, then freezes on the last frame.
 * Uses a canvas to capture the final frame so there's no visual swap.
 */
export function AnimatedPageIcon({ name }: AnimatedPageIconProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    // After the GIF plays through (~4s), capture the current frame onto
    // the canvas and hide the original img. The canvas shows the frozen frame.
    const timer = setTimeout(() => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      canvas.style.display = 'block';
      img.style.display = 'none';
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <span className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={`/icons/${name}.gif`}
        alt=""
        className="w-8 h-8 object-contain"
      />
      <canvas
        ref={canvasRef}
        className="w-8 h-8 object-contain"
        style={{ display: 'none' }}
      />
    </span>
  );
}
