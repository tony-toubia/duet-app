import { Platform } from 'react-native';
import {
  InterstitialAd,
  RewardedAd,
  AdEventType,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import Constants from 'expo-constants';

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

  private rewarded: RewardedAd | null = null;
  private rewardedLoaded = false;
  private rewardedEarned = false;
  private onRewardedClosedResolve: ((earned: boolean) => void) | null = null;

  /**
   * Initialize and preload all ads
   */
  initialize(): void {
    this.loadInterstitial();
    this.loadRewarded();
  }

  // ── Interstitial ──

  private loadInterstitial(): void {
    this.interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID);

    this.interstitial.addAdEventListener(AdEventType.LOADED, () => {
      console.log('[Ad] Interstitial loaded');
      this.isLoaded = true;
    });

    this.interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('[Ad] Interstitial closed');
      this.isLoaded = false;
      if (this.onClosedResolve) {
        this.onClosedResolve();
        this.onClosedResolve = null;
      }
      this.loadInterstitial();
    });

    this.interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
      console.log('[Ad] Interstitial error:', error);
      this.isLoaded = false;
      // Retry after a delay
      setTimeout(() => this.loadInterstitial(), 30000);
    });

    this.interstitial.load();
  }

  /**
   * Check if the next room leave will trigger an interstitial.
   */
  willShowInterstitial(): boolean {
    return (this.roomLeaveCount + 1) % 3 === 0 && this.isLoaded && !!this.interstitial;
  }

  /**
   * Show an interstitial ad every 3rd room leave.
   * Returns a promise that resolves when the ad is closed (or immediately if no ad shown).
   */
  async onRoomLeave(): Promise<void> {
    this.roomLeaveCount++;

    if (this.roomLeaveCount % 3 === 0 && this.isLoaded && this.interstitial) {
      try {
        const closedPromise = new Promise<void>((resolve) => {
          this.onClosedResolve = resolve;
        });
        await this.interstitial.show();
        await closedPromise;
      } catch (error) {
        console.log('[Ad] Failed to show interstitial:', error);
        this.onClosedResolve = null;
      }
    }
  }

  // ── Rewarded ──

  private loadRewarded(): void {
    this.rewarded = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID);
    this.rewardedEarned = false;

    this.rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
      console.log('[Ad] Rewarded loaded');
      this.rewardedLoaded = true;
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
      this.loadRewarded();
    });

    this.rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
      console.log('[Ad] Rewarded error:', error);
      this.rewardedLoaded = false;
      // Retry after a delay
      setTimeout(() => this.loadRewarded(), 30000);
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
      return await closedPromise;
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
