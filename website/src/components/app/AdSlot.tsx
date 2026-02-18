'use client';

import { useEffect, useRef } from 'react';

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
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

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

  if (!clientId || !adSlot) return null;

  return (
    <ins
      ref={adRef}
      className={`adsbygoogle ${className}`}
      style={{ display: 'block', background: 'transparent' }}
      data-ad-client={clientId}
      data-ad-slot={adSlot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}
