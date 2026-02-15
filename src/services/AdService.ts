import { Platform } from 'react-native';
import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import Constants from 'expo-constants';

const getInterstitialAdUnitId = () => {
  if (__DEV__) return TestIds.INTERSTITIAL;
  const extras = Constants.expoConfig?.extra;
  const id = Platform.OS === 'ios' ? extras?.admobInterstitialIdIos : extras?.admobInterstitialIdAndroid;
  console.log('[Ad] Interstitial unit ID:', id ? '(set)' : '(missing)', 'Platform:', Platform.OS);
  return id || TestIds.INTERSTITIAL;
};

const INTERSTITIAL_AD_UNIT_ID = getInterstitialAdUnitId();

class AdService {
  private interstitial: InterstitialAd | null = null;
  private roomLeaveCount = 0;
  private isLoaded = false;

  /**
   * Initialize and preload the interstitial ad
   */
  initialize(): void {
    this.loadInterstitial();
  }

  private loadInterstitial(): void {
    this.interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID);

    this.interstitial.addAdEventListener(AdEventType.LOADED, () => {
      console.log('[Ad] Interstitial loaded');
      this.isLoaded = true;
    });

    this.interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('[Ad] Interstitial closed');
      this.isLoaded = false;
      // Preload the next one
      this.loadInterstitial();
    });

    this.interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
      console.log('[Ad] Interstitial error:', error);
      this.isLoaded = false;
    });

    this.interstitial.load();
  }

  /**
   * Show an interstitial ad every 3rd room leave
   */
  async onRoomLeave(): Promise<void> {
    this.roomLeaveCount++;

    if (this.roomLeaveCount % 3 === 0 && this.isLoaded && this.interstitial) {
      try {
        await this.interstitial.show();
      } catch (error) {
        console.log('[Ad] Failed to show interstitial:', error);
      }
    }
  }
}

export const adService = new AdService();
