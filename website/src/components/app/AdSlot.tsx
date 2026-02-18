'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

interface AdSlotProps {
  adSlot: string;
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical';
  className?: string;
}

export function AdSlot({ adSlot: rawAdSlot, format = 'auto', className = '' }: AdSlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pushed = useRef(false);
  const [adFilled, setAdFilled] = useState(false);

  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim();
  const adSlot = rawAdSlot?.trim();

  useEffect(() => {
    if (!clientId || !adSlot || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch (e) {
      console.warn('[AdSlot] adsbygoogle push failed:', e);
    }
  }, [clientId, adSlot]);

  // Watch for AdSense filling the slot (it changes data-ad-status to "filled")
  useEffect(() => {
    const ins = containerRef.current?.querySelector('ins');
    if (!ins) return;
    const observer = new MutationObserver(() => {
      if (ins.getAttribute('data-ad-status') === 'filled') {
        setAdFilled(true);
      }
    });
    observer.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
    // Check if already filled
    if (ins.getAttribute('data-ad-status') === 'filled') setAdFilled(true);
    return () => observer.disconnect();
  }, [clientId, adSlot]);

  if (!clientId || !adSlot) return null;

  return (
    <div
      ref={containerRef}
      style={{ overflow: 'hidden', maxHeight: adFilled ? 'none' : 0, transition: 'max-height 0.3s' }}
    >
      <ins
        className={`adsbygoogle ${className}`}
        style={{ display: 'block' }}
        data-ad-client={clientId}
        data-ad-slot={adSlot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
