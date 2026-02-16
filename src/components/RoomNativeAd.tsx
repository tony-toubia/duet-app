import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
  NativeMediaAspectRatio,
  TestIds,
} from 'react-native-google-mobile-ads';
import Constants from 'expo-constants';

const getNativeAdUnitId = () => {
  if (__DEV__) return TestIds.NATIVE;
  const extras = Constants.expoConfig?.extra;
  const id = Platform.OS === 'ios' ? extras?.admobNativeIdIos : extras?.admobNativeIdAndroid;
  console.log('[Ad] Native unit ID:', id ? '(set)' : '(missing)', 'Platform:', Platform.OS);
  return id || TestIds.NATIVE;
};

const NATIVE_AD_UNIT_ID = getNativeAdUnitId();

const renderStars = (rating: number) => {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  let stars = '\u2605'.repeat(full);
  if (half) stars += '\u00BD';
  return stars;
};

export const RoomNativeAd = () => {
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);

  useEffect(() => {
    let destroyed = false;
    let ad: NativeAd | null = null;

    NativeAd.createForAdRequest(NATIVE_AD_UNIT_ID, {
      aspectRatio: NativeMediaAspectRatio.LANDSCAPE,
    })
      .then((loadedAd) => {
        if (!destroyed) {
          ad = loadedAd;
          setNativeAd(loadedAd);
          console.log('[Ad] Native ad loaded');
        } else {
          loadedAd.destroy();
        }
      })
      .catch((err) => {
        console.log('[Ad] Native ad failed to load:', err.message);
      });

    return () => {
      destroyed = true;
      ad?.destroy();
    };
  }, []);

  if (!nativeAd) return null;

  const hasMedia = !!nativeAd.mediaContent;
  const hasIcon = !!nativeAd.icon;

  return (
    <NativeAdView nativeAd={nativeAd} style={styles.container}>
      <View style={styles.card}>
        {/* Top: media banner on black bg — centers content with letterbox bars */}
        {hasMedia && (
          <View style={styles.mediaBannerWrap}>
            <NativeMediaView style={styles.mediaBanner} resizeMode="contain" />
          </View>
        )}

        {/* Bottom: info row */}
        <View style={styles.infoRow}>
          {/* App icon */}
          {hasIcon && (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image source={{ uri: nativeAd.icon!.url }} style={styles.appIcon} />
            </NativeAsset>
          )}

          {/* Text column */}
          <View style={styles.textCol}>
            <View style={styles.metaRow}>
              <Text style={styles.adBadge}>Ad</Text>
              {nativeAd.starRating != null && nativeAd.starRating > 0 && (
                <Text style={styles.stars}>{renderStars(nativeAd.starRating)}</Text>
              )}
            </View>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text style={styles.headline} numberOfLines={2}>{nativeAd.headline}</Text>
            </NativeAsset>
            {nativeAd.body && (
              <NativeAsset assetType={NativeAssetType.BODY}>
                <Text style={styles.body} numberOfLines={2}>{nativeAd.body}</Text>
              </NativeAsset>
            )}
            {nativeAd.advertiser && (
              <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                <Text style={styles.advertiser} numberOfLines={1}>{nativeAd.advertiser}</Text>
              </NativeAsset>
            )}
          </View>

          {/* CTA button — right-aligned */}
          {nativeAd.callToAction && (
            <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
              <Text style={styles.cta}>{nativeAd.callToAction}</Text>
            </NativeAsset>
          )}
        </View>
      </View>
    </NativeAdView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
  },
  mediaBannerWrap: {
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaBanner: {
    width: '100%',
    height: 140,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  appIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  adBadge: {
    color: '#999',
    fontSize: 9,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 0.5,
    overflow: 'hidden',
  },
  stars: {
    color: '#f5a623',
    fontSize: 11,
  },
  advertiser: {
    color: '#999',
    fontSize: 10,
  },
  headline: {
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: '600',
  },
  body: {
    color: '#666',
    fontSize: 11,
    lineHeight: 15,
  },
  cta: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: '#e8734a',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
});
