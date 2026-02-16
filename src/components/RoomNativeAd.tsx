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
import { colors } from '@/theme';

const getNativeAdUnitId = () => {
  if (__DEV__) return TestIds.NATIVE;
  const extras = Constants.expoConfig?.extra;
  const id = Platform.OS === 'ios' ? extras?.admobNativeIdIos : extras?.admobNativeIdAndroid;
  console.log('[Ad] Native unit ID:', id ? '(set)' : '(missing)', 'Platform:', Platform.OS);
  return id || TestIds.NATIVE;
};

const NATIVE_AD_UNIT_ID = getNativeAdUnitId();

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

  return (
    <NativeAdView nativeAd={nativeAd} style={styles.container}>
      <View style={styles.header}>
        {nativeAd.icon && (
          <NativeAsset assetType={NativeAssetType.ICON}>
            <Image source={{ uri: nativeAd.icon.url }} style={styles.icon} />
          </NativeAsset>
        )}
        <View style={styles.headerText}>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text style={styles.headline} numberOfLines={1}>{nativeAd.headline}</Text>
          </NativeAsset>
          {nativeAd.advertiser && (
            <NativeAsset assetType={NativeAssetType.ADVERTISER}>
              <Text style={styles.advertiser} numberOfLines={1}>{nativeAd.advertiser}</Text>
            </NativeAsset>
          )}
        </View>
        <Text style={styles.adBadge}>Ad</Text>
      </View>

      {nativeAd.body && (
        <NativeAsset assetType={NativeAssetType.BODY}>
          <Text style={styles.body} numberOfLines={2}>{nativeAd.body}</Text>
        </NativeAsset>
      )}

      {nativeAd.mediaContent && (
        <NativeMediaView style={styles.media} resizeMode="cover" />
      )}

      {nativeAd.callToAction && (
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <Text style={styles.cta}>{nativeAd.callToAction}</Text>
        </NativeAsset>
      )}
    </NativeAdView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginHorizontal: 20,
    padding: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  headerText: {
    flex: 1,
  },
  headline: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  advertiser: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  adBadge: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  body: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  media: {
    height: 150,
    borderRadius: 10,
    marginTop: 10,
    overflow: 'hidden',
  },
  cta: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 10,
    marginTop: 10,
    overflow: 'hidden',
  },
});
