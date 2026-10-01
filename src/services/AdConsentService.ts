import { Platform } from 'react-native';
import * as TrackingTransparency from 'expo-tracking-transparency';

const ads = require('react-native-google-mobile-ads');
const mobileAds = ads.default;
const AdsConsent = ads.AdsConsent;
const AdsConsentPrivacyOptionsRequirementStatus = ads.AdsConsentPrivacyOptionsRequirementStatus;
const MaxAdContentRating = ads.MaxAdContentRating;

// Age band from the age gate. Minors never get personalized ads or the
// tracking prompt; under-16s are also tagged "under the age of consent" so
// Google treats their requests accordingly (GDPR Art. 8).
import type { AgeBand } from '@/lib/ageGate';

/**
 * Ad consent and tracking, in the order Google and Apple expect:
 * 1. Google UMP gathers consent where the law requires it (EEA, UK,
 *    Switzerland and some US states) using the messages configured in AdMob
 *    → Privacy & messaging.
 * 2. On iOS, App Tracking Transparency is requested (adults only).
 * 3. The Mobile Ads SDK is initialized, and ads load only if UMP says the
 *    app may request them.
 *
 * Every ad load must wait for prepare() and use requestOptions().
 */
class AdConsentService {
  private preparing: Promise<void> | null = null;
  private resolveReady!: () => void;
  // Resolves once prepare() has finished, whenever that is; ad components
  // that mount early wait on this instead of requesting ads unconsented
  private readyPromise = new Promise<void>((resolve) => {
    this.resolveReady = resolve;
  });
  private _canRequestAds = false;
  private _privacyOptionsRequired = false;
  private ageBand: AgeBand = 'adult';

  prepare(ageBand: AgeBand): Promise<void> {
    if (!this.preparing) {
      this.ageBand = ageBand;
      this.preparing = this.run()
        .catch((error) => {
          console.warn('[AdConsent] Consent flow failed; ads disabled for this session:', error);
          this._canRequestAds = false;
        })
        .finally(() => this.resolveReady());
    }
    return this.preparing;
  }

  /** Wait until consent has been gathered (or the flow has failed). */
  ready(): Promise<void> {
    return this.readyPromise;
  }

  private async run(): Promise<void> {
    const minor = this.ageBand !== 'adult';
    await mobileAds().setRequestConfiguration({
      tagForUnderAgeOfConsent: this.ageBand === 'under16',
      // Keep ads for teens to teen-appropriate content
      ...(minor ? { maxAdContentRating: MaxAdContentRating.T } : {}),
    });

    let info: { canRequestAds: boolean; privacyOptionsRequirementStatus: string } | null = null;
    try {
      // Requests the consent status and shows the form only when required
      info = await AdsConsent.gatherConsent({ tagForUnderAgeOfConsent: this.ageBand === 'under16' });
    } catch (error) {
      // Offline or misconfigured: fall back to whatever was stored last time
      console.warn('[AdConsent] gatherConsent failed:', error);
      info = await AdsConsent.getConsentInfo().catch(() => null);
    }
    this._canRequestAds = !!info?.canRequestAds;
    this._privacyOptionsRequired =
      info?.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;

    if (Platform.OS === 'ios' && !minor && this._canRequestAds) {
      try {
        const { status } = await TrackingTransparency.getTrackingPermissionsAsync();
        if (status === 'undetermined') await TrackingTransparency.requestTrackingPermissionsAsync();
      } catch (error) {
        console.warn('[AdConsent] Tracking permission request failed:', error);
      }
    }

    if (this._canRequestAds) await mobileAds().initialize();
    console.log('[AdConsent] canRequestAds:', this._canRequestAds, 'age band:', this.ageBand);
  }

  /** False until consent is gathered, and whenever UMP says no ads may be requested. */
  get canRequestAds(): boolean {
    return this._canRequestAds;
  }

  /** Whether to show an "Ad privacy choices" entry point (required by UMP when true). */
  get privacyOptionsRequired(): boolean {
    return this._privacyOptionsRequired;
  }

  /** Options for every ad request. Minors only ever get non-personalized ads. */
  requestOptions(): { requestNonPersonalizedAdsOnly: boolean } {
    return { requestNonPersonalizedAdsOnly: this.ageBand !== 'adult' };
  }

  /** Re-open the consent form so the user can change their choices. */
  async showPrivacyOptions(): Promise<void> {
    const info = await AdsConsent.showPrivacyOptionsForm();
    this._canRequestAds = !!info?.canRequestAds;
  }
}

export const adConsentService = new AdConsentService();
