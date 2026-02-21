'use client';

import { useEffect, useRef } from 'react';
import lottie from 'lottie-web';

export function HeroLights() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: '/hero-lights.json',
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid slice',
      },
    });

    return () => anim.destroy();
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      aria-hidden="true"
    />
  );
}
