/**
 * Ad Service (Web)
 *
 * Uses Google IMA SDK for interstitial ads when NEXT_PUBLIC_IMA_VAST_TAG is set.
 * Falls back to granting free extensions if no VAST tag is configured.
 */

const AD_TIMEOUT_MS = 10_000;

class AdService {
  private roomLeaveCount = 0;

  initialize(): void {
    console.log('[Ad] Web ad service initialized');
  }

  willShowInterstitial(): boolean {
    return false;
  }

  async onRoomLeave(): Promise<void> {
    this.roomLeaveCount++;
  }

  /**
   * Show a rewarded ad (for guest session extension).
   * Returns true if extension should be granted.
   */
  async showRewarded(): Promise<boolean> {
    return this.showImaInterstitial();
  }

  /**
   * Show a pre-roll interstitial ad (for room entry).
   * Resolves when the ad is closed (or immediately if unavailable).
   */
  async showPreRoll(): Promise<void> {
    await this.showImaInterstitial();
  }

  get isRewardedReady(): boolean {
    return this.isImaAvailable();
  }

  get isPreRollReady(): boolean {
    return this.isImaAvailable();
  }

  private isImaAvailable(): boolean {
    const vastTag = process.env.NEXT_PUBLIC_IMA_VAST_TAG?.trim();
    return !!vastTag && typeof window !== 'undefined' && !!window.google?.ima;
  }

  /**
   * Show an IMA interstitial ad in a fullscreen overlay.
   * Returns true when the ad completes (or if no ads are configured — grants free).
   */
  private async showImaInterstitial(): Promise<boolean> {
    const vastTag = process.env.NEXT_PUBLIC_IMA_VAST_TAG?.trim();
    const ima = typeof window !== 'undefined' ? window.google?.ima : undefined;

    if (!vastTag || !ima) {
      // No ads configured — grant free
      return true;
    }

    return new Promise<boolean>((resolve) => {
      let completed = false;
      const complete = (result: boolean) => {
        if (completed) return;
        completed = true;
        clearTimeout(timeout);
        // Clean up DOM
        try { adsManager?.destroy(); } catch {}
        try { adsLoader?.destroy(); } catch {}
        try { adDisplayContainer?.destroy(); } catch {}
        try { containerDiv?.remove(); } catch {}
        resolve(result);
      };

      // Safety timeout
      const timeout = setTimeout(() => {
        console.warn('[Ad] IMA ad timed out');
        complete(true);
      }, AD_TIMEOUT_MS);

      // Create overlay container
      const containerDiv = document.createElement('div');
      containerDiv.style.cssText =
        'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.9);' +
        'display:flex;align-items:center;justify-content:center;';
      document.body.appendChild(containerDiv);

      const adDiv = document.createElement('div');
      adDiv.style.cssText = 'width:min(640px,90vw);height:min(360px,50vh);';
      containerDiv.appendChild(adDiv);

      const videoEl = document.createElement('video');
      videoEl.playsInline = true;
      videoEl.style.cssText = 'width:100%;height:100%;background:#000;border-radius:12px;';
      adDiv.appendChild(videoEl);

      let adsManager: any = null;
      let adsLoader: any = null;
      let adDisplayContainer: any = null;

      try {
        adDisplayContainer = new ima.AdDisplayContainer(adDiv, videoEl);
        adDisplayContainer.initialize();

        adsLoader = new ima.AdsLoader(adDisplayContainer);

        adsLoader.addEventListener(
          ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
          (event: any) => {
            adsManager = event.getAdsManager(videoEl);

            adsManager.addEventListener(ima.AdEvent.Type.COMPLETE, () => complete(true));
            adsManager.addEventListener(ima.AdEvent.Type.ALL_ADS_COMPLETED, () => complete(true));
            adsManager.addEventListener(ima.AdEvent.Type.SKIPPED, () => complete(true));
            adsManager.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, () => {
              console.warn('[Ad] IMA ad error during playback');
              complete(true);
            });

            try {
              const width = adDiv.offsetWidth || 640;
              const height = adDiv.offsetHeight || 360;
              adsManager.init(width, height, ima.ViewMode.NORMAL);
              adsManager.start();
            } catch (err) {
              console.warn('[Ad] Failed to start IMA ad:', err);
              complete(true);
            }
          },
        );

        adsLoader.addEventListener(
          ima.AdErrorEvent.Type.AD_ERROR,
          () => {
            console.warn('[Ad] IMA loader error (no fill or network)');
            complete(true);
          },
        );

        const adsRequest = new ima.AdsRequest();
        adsRequest.adTagUrl = vastTag;
        adsRequest.linearAdSlotWidth = 640;
        adsRequest.linearAdSlotHeight = 360;
        adsRequest.nonLinearAdSlotWidth = 640;
        adsRequest.nonLinearAdSlotHeight = 150;
        adsLoader.requestAds(adsRequest);
      } catch (err) {
        console.warn('[Ad] Failed to initialize IMA:', err);
        complete(true);
      }
    });
  }
}

export const adService = new AdService();
