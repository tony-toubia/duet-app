'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Spinner } from '@/components/ui/Spinner';

/* ------------------------------------------------------------------ */
/*  Minimal IMA SDK type declarations (no @types package exists)      */
/* ------------------------------------------------------------------ */

declare global {
  interface Window {
    google?: {
      ima: {
        AdDisplayContainer: new (
          container: HTMLElement,
          video: HTMLVideoElement,
        ) => ImaAdDisplayContainer;
        AdsLoader: new (container: ImaAdDisplayContainer) => ImaAdsLoader;
        AdsRequest: new () => ImaAdsRequest;
        AdsManagerLoadedEvent: { Type: { ADS_MANAGER_LOADED: string } };
        AdErrorEvent: { Type: { AD_ERROR: string } };
        AdEvent: {
          Type: {
            COMPLETE: string;
            ALL_ADS_COMPLETED: string;
            SKIPPED: string;
            STARTED: string;
            LOADED: string;
          };
        };
        ViewMode: { NORMAL: string };
      };
    };
  }
}

export interface ImaAdDisplayContainer {
  initialize(): void;
  destroy(): void;
}

interface ImaAdsLoader {
  addEventListener(event: string, handler: (e: any) => void): void;
  requestAds(request: ImaAdsRequest): void;
  contentComplete(): void;
  destroy(): void;
}

interface ImaAdsRequest {
  adTagUrl: string;
  linearAdSlotWidth: number;
  linearAdSlotHeight: number;
  nonLinearAdSlotWidth: number;
  nonLinearAdSlotHeight: number;
}

interface ImaAdsManager {
  addEventListener(event: string, handler: (e: any) => void): void;
  init(width: number, height: number, viewMode: string): void;
  start(): void;
  destroy(): void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface PreRollAdProps {
  /** Pre-initialized AdDisplayContainer (created in click handler) */
  adDisplayContainer: ImaAdDisplayContainer;
  /** Video element used by IMA */
  videoElement: HTMLVideoElement;
  /** Container div used by IMA */
  adContainerElement: HTMLElement;
  /** Called when ad finishes, errors, or times out */
  onComplete: () => void;
}

const AD_TIMEOUT_MS = 10_000;

export function PreRollAd({
  adDisplayContainer,
  videoElement,
  adContainerElement,
  onComplete,
}: PreRollAdProps) {
  const adsManagerRef = useRef<ImaAdsManager | null>(null);
  const adsLoaderRef = useRef<ImaAdsLoader | null>(null);
  const completedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    try { adsManagerRef.current?.destroy(); } catch {}
    try { adsLoaderRef.current?.destroy(); } catch {}
    try { adDisplayContainer.destroy(); } catch {}

    onComplete();
  }, [onComplete, adDisplayContainer]);

  useEffect(() => {
    const ima = window.google?.ima;
    if (!ima) {
      console.warn('[PreRollAd] IMA SDK not loaded, skipping ad');
      handleComplete();
      return;
    }

    const vastTag = process.env.NEXT_PUBLIC_IMA_VAST_TAG?.trim();
    if (!vastTag) {
      handleComplete();
      return;
    }

    // Safety timeout
    timeoutRef.current = setTimeout(() => {
      console.warn('[PreRollAd] Ad timed out after', AD_TIMEOUT_MS, 'ms');
      handleComplete();
    }, AD_TIMEOUT_MS);

    // Create AdsLoader
    const adsLoader = new ima.AdsLoader(adDisplayContainer);
    adsLoaderRef.current = adsLoader;

    // ADS_MANAGER_LOADED — ad is ready to play
    adsLoader.addEventListener(
      ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
      (event: any) => {
        const adsManager: ImaAdsManager = event.getAdsManager(videoElement);
        adsManagerRef.current = adsManager;

        adsManager.addEventListener(ima.AdEvent.Type.COMPLETE, handleComplete);
        adsManager.addEventListener(ima.AdEvent.Type.ALL_ADS_COMPLETED, handleComplete);
        adsManager.addEventListener(ima.AdEvent.Type.SKIPPED, handleComplete);
        adsManager.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, (e: any) => {
          console.warn('[PreRollAd] Ad error:', e.getError?.()?.toString?.());
          handleComplete();
        });

        try {
          const width = adContainerElement.offsetWidth || 640;
          const height = adContainerElement.offsetHeight || 360;
          adsManager.init(width, height, ima.ViewMode.NORMAL);
          adsManager.start();
        } catch (err) {
          console.warn('[PreRollAd] adsManager.start() failed:', err);
          handleComplete();
        }
      },
    );

    // AD_ERROR on loader level (no fill, network error, etc.)
    adsLoader.addEventListener(
      ima.AdErrorEvent.Type.AD_ERROR,
      (e: any) => {
        console.warn('[PreRollAd] AdsLoader error:', e.getError?.()?.toString?.());
        handleComplete();
      },
    );

    // Request ads
    const adsRequest = new ima.AdsRequest();
    adsRequest.adTagUrl = vastTag;
    adsRequest.linearAdSlotWidth = 640;
    adsRequest.linearAdSlotHeight = 360;
    adsRequest.nonLinearAdSlotWidth = 640;
    adsRequest.nonLinearAdSlotHeight = 150;
    adsLoader.requestAds(adsRequest);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      try { adsManagerRef.current?.destroy(); } catch {}
      try { adsLoaderRef.current?.destroy(); } catch {}
    };
  }, [adDisplayContainer, videoElement, adContainerElement, handleComplete]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center">
      <div className="text-white text-lg font-semibold mb-6 flex items-center gap-3">
        <Spinner size="sm" />
        Connecting your room...
      </div>
    </div>
  );
}
