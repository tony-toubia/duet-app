import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Google Mobile Ads SDK crashes on iOS 26 - disabled on iOS via react-native.config.js
let InterstitialAd: any = null;
let RewardedAd: any = null;
let AdEventType: any = {};
let RewardedAdEventType: any = {};
let TestIds: any = { INTERSTITIAL: '', REWARDED: '' };
if (Platform.OS !== 'ios') {
  const ads = require('react-native-google-mobile-ads');
  InterstitialAd = ads.InterstitialAd;
  RewardedAd = ads.RewardedAd;
  AdEventType = ads.AdEventType;
  RewardedAdEventType = ads.RewardedAdEventType;
  TestIds = ads.TestIds;
}

const getInterstitialAdUnitId = () => {
  if (__DEV__) return TestIds.INTERSTITIAL;
  const extras = Constants.expoConfig?.extra;
  const id = Platform.OS === 'ios' ? extras?.admobInterstitialIdIos : extras?.admobInterstitialIdAndroid;
  console.log('[Ad] Interstitial unit ID:', id ? '(set)' : '(missing)', 'Platform:', Platform.OS);
  return id || TestIds.INTERSTITIAL;
};

const getRewardedAdUnitId = () => {
  if (__DEV__) return TestIds.REWARDED;
  const extras = Constants.expoConfig?.extra;
  const id = Platform.OS === 'ios' ? extras?.admobRewardedIdIos : extras?.admobRewardedIdAndroid;
  console.log('[Ad] Rewarded unit ID:', id ? '(set)' : '(missing)', 'Platform:', Platform.OS);
  return id || TestIds.REWARDED;
};

const INTERSTITIAL_AD_UNIT_ID = getInterstitialAdUnitId();
const REWARDED_AD_UNIT_ID = getRewardedAdUnitId();

class AdService {
  private interstitial: InterstitialAd | null = null;
  private roomLeaveCount = 0;
  private isLoaded = false;
  private onClosedResolve: (() => void) | null = null;
  private interstitialRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private interstitialRetryCount = 0;

  private rewarded: RewardedAd | null = null;
  private rewardedLoaded = false;
  private rewardedEarned = false;
  private onRewardedClosedResolve: ((earned: boolean) => void) | null = null;
  private rewardedRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private rewardedRetryCount = 0;

  // Frequency cap: max 1 interstitial per 30 minutes
  private lastInterstitialShownAt = 0;
  private static readonly INTERSTITIAL_COOLDOWN_MS = 30 * 60 * 1000;

  // Ad-free window from rewarded ads (1 hour)
  private adFreeUntil = 0;
  private static readonly AD_FREE_DURATION_MS = 60 * 60 * 1000;

  /**
   * Initialize and preload all ads
   */
  initialize(): void {
    if (Platform.OS === 'ios') return; // Ads disabled on iOS due to SDK crash on iOS 26
    this.loadInterstitial();
    this.loadRewarded();
  }

  // ── Interstitial ──

  private loadInterstitial(): void {
    // Clear any pending retry
    if (this.interstitialRetryTimer) {
      clearTimeout(this.interstitialRetryTimer);
      this.interstitialRetryTimer = null;
    }

    this.interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID);

    this.interstitial.addAdEventListener(AdEventType.LOADED, () => {
      console.log('[Ad] Interstitial loaded');
      this.isLoaded = true;
      this.interstitialRetryCount = 0;
    });

    this.interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('[Ad] Interstitial closed');
      this.isLoaded = false;
      if (this.onClosedResolve) {
        this.onClosedResolve();
        this.onClosedResolve = null;
      }
      this.interstitialRetryCount = 0;
      this.loadInterstitial();
    });

    this.interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
      console.log('[Ad] Interstitial error:', error);
      this.isLoaded = false;
      // Exponential backoff: 30s, 60s, 120s, 240s, capped at 5 min
      const delay = Math.min(30000 * Math.pow(2, this.interstitialRetryCount), 300000);
      this.interstitialRetryCount++;
      console.log(`[Ad] Interstitial retry in ${delay / 1000}s (attempt ${this.interstitialRetryCount})`);
      this.interstitialRetryTimer = setTimeout(() => this.loadInterstitial(), delay);
    });

    this.interstitial.load();
  }

  /**
   * Whether the user is currently in an ad-free window (from watching a rewarded ad).
   */
  get isAdFree(): boolean {
    return Date.now() < this.adFreeUntil;
  }

  /**
   * Check if the next room leave will trigger an interstitial.
   */
  willShowInterstitial(): boolean {
    if (this.isAdFree) return false;
    const cooldownOk = Date.now() - this.lastInterstitialShownAt >= AdService.INTERSTITIAL_COOLDOWN_MS;
    return (this.roomLeaveCount + 1) % 3 === 0 && this.isLoaded && !!this.interstitial && cooldownOk;
  }

  /**
   * Show an interstitial ad every 3rd room leave, with frequency cap.
   * Respects ad-free window from rewarded ads and 30-minute cooldown.
   */
  async onRoomLeave(): Promise<void> {
    this.roomLeaveCount++;

    if (this.isAdFree) {
      console.log('[Ad] Ad-free window active, skipping interstitial');
      return;
    }

    const cooldownOk = Date.now() - this.lastInterstitialShownAt >= AdService.INTERSTITIAL_COOLDOWN_MS;
    if (this.roomLeaveCount % 3 === 0 && this.isLoaded && this.interstitial && cooldownOk) {
      try {
        const closedPromise = new Promise<void>((resolve) => {
          this.onClosedResolve = resolve;
        });
        await this.interstitial.show();
        this.lastInterstitialShownAt = Date.now();
        await closedPromise;
      } catch (error) {
        console.log('[Ad] Failed to show interstitial:', error);
        this.onClosedResolve = null;
      }
    }
  }

  // ── Rewarded ──

  private loadRewarded(): void {
    // Clear any pending retry
    if (this.rewardedRetryTimer) {
      clearTimeout(this.rewardedRetryTimer);
      this.rewardedRetryTimer = null;
    }

    this.rewarded = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID);
    this.rewardedEarned = false;

    this.rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
      console.log('[Ad] Rewarded loaded');
      this.rewardedLoaded = true;
      this.rewardedRetryCount = 0;
    });

    this.rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      console.log('[Ad] Reward earned');
      this.rewardedEarned = true;
    });

    this.rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('[Ad] Rewarded closed, earned:', this.rewardedEarned);
      this.rewardedLoaded = false;
      if (this.onRewardedClosedResolve) {
        this.onRewardedClosedResolve(this.rewardedEarned);
        this.onRewardedClosedResolve = null;
      }
      this.rewardedRetryCount = 0;
      this.loadRewarded();
    });

    this.rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
      console.log('[Ad] Rewarded error:', error);
      this.rewardedLoaded = false;
      // Exponential backoff: 30s, 60s, 120s, 240s, capped at 5 min
      const delay = Math.min(30000 * Math.pow(2, this.rewardedRetryCount), 300000);
      this.rewardedRetryCount++;
      console.log(`[Ad] Rewarded retry in ${delay / 1000}s (attempt ${this.rewardedRetryCount})`);
      this.rewardedRetryTimer = setTimeout(() => this.loadRewarded(), delay);
    });

    this.rewarded.load();
  }

  /**
   * Show a rewarded ad. Returns true if the user earned the reward
   * (watched to completion), false if dismissed early or failed.
   */
  async showRewarded(): Promise<boolean> {
    if (!this.rewardedLoaded || !this.rewarded) {
      console.log('[Ad] Rewarded not ready');
      return false;
    }

    try {
      this.rewardedEarned = false;
      const closedPromise = new Promise<boolean>((resolve) => {
        this.onRewardedClosedResolve = resolve;
      });
      await this.rewarded.show();
      const earned = await closedPromise;
      if (earned) {
        this.adFreeUntil = Date.now() + AdService.AD_FREE_DURATION_MS;
        console.log('[Ad] Ad-free window granted for 1 hour');
      }
      return earned;
    } catch (error) {
      console.log('[Ad] Failed to show rewarded:', error);
      this.onRewardedClosedResolve = null;
      return false;
    }
  }

  get isRewardedReady(): boolean {
    return this.rewardedLoaded;
  }

  // ── Pre-Roll (Room Entry) ──

  /**
   * Show an interstitial ad immediately (for room entry pre-roll).
   * Resolves when the ad is closed, or immediately if no ad is loaded.
   */
  async showPreRoll(): Promise<void> {
    if (!this.isLoaded || !this.interstitial) {
      console.log('[Ad] Pre-roll not ready, skipping');
      return;
    }
    try {
      const closedPromise = new Promise<void>((resolve) => {
        this.onClosedResolve = resolve;
      });
      await this.interstitial.show();
      await closedPromise;
    } catch (error) {
      console.log('[Ad] Failed to show pre-roll:', error);
      this.onClosedResolve = null;
    }
  }

  get isPreRollReady(): boolean {
    return this.isLoaded;
  }
}

export const adService = new AdService();
