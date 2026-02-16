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
      aspectRatio: NativeMediaAspectRatio.SQUARE,
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

  return (
    <NativeAdView nativeAd={nativeAd} style={styles.container}>
      <View style={styles.card}>
        <View style={styles.row}>
          {/* Left: media or icon thumbnail */}
          {nativeAd.mediaContent ? (
            <NativeMediaView style={styles.mediaThumbnail} resizeMode="cover" />
          ) : nativeAd.icon ? (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image source={{ uri: nativeAd.icon.url }} style={styles.mediaThumbnail} />
            </NativeAsset>
          ) : null}

          {/* Right: text + CTA */}
          <View style={styles.rightCol}>
            <View style={styles.metaRow}>
              <Text style={styles.adBadge}>Ad</Text>
              {nativeAd.starRating != null && nativeAd.starRating > 0 && (
                <Text style={styles.stars}>{renderStars(nativeAd.starRating)}</Text>
              )}
              {nativeAd.advertiser && (
                <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                  <Text style={styles.advertiser} numberOfLines={1}>{nativeAd.advertiser}</Text>
                </NativeAsset>
              )}
            </View>
            {nativeAd.icon && nativeAd.mediaContent && (
              <View style={styles.iconRow}>
                <NativeAsset assetType={NativeAssetType.ICON}>
                  <Image source={{ uri: nativeAd.icon.url }} style={styles.iconSmall} />
                </NativeAsset>
                <NativeAsset assetType={NativeAssetType.HEADLINE}>
                  <Text style={styles.headline} numberOfLines={1}>{nativeAd.headline}</Text>
                </NativeAsset>
              </View>
            )}
            {(!nativeAd.icon || !nativeAd.mediaContent) && (
              <NativeAsset assetType={NativeAssetType.HEADLINE}>
                <Text style={styles.headline} numberOfLines={2}>{nativeAd.headline}</Text>
              </NativeAsset>
            )}
            {nativeAd.body && (
              <NativeAsset assetType={NativeAssetType.BODY}>
                <Text style={styles.body} numberOfLines={1}>{nativeAd.body}</Text>
              </NativeAsset>
            )}
            {nativeAd.callToAction && (
              <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
                <Text style={styles.cta}>{nativeAd.callToAction}</Text>
              </NativeAsset>
            )}
          </View>
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  mediaThumbnail: {
    width: 90,
    height: 90,
    borderRadius: 10,
    overflow: 'hidden',
  },
  rightCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adBadge: {
    color: '#888',
    fontSize: 9,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  stars: {
    color: '#f5a623',
    fontSize: 11,
  },
  advertiser: {
    color: '#666',
    fontSize: 11,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconSmall: {
    width: 20,
    height: 20,
    borderRadius: 5,
  },
  headline: {
    color: '#1a1a2e',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  body: {
    color: '#666',
    fontSize: 11,
  },
  cta: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: '#e8734a',
    borderRadius: 10,
    paddingVertical: 7,
    overflow: 'hidden',
    marginTop: 2,
  },
});
