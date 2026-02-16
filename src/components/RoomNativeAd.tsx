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
      <View style={styles.row}>
        {nativeAd.mediaContent && (
          <NativeMediaView style={styles.media} resizeMode="cover" />
        )}
        <View style={styles.info}>
          <View style={styles.header}>
            {nativeAd.icon && (
              <NativeAsset assetType={NativeAssetType.ICON}>
                <Image source={{ uri: nativeAd.icon.url }} style={styles.icon} />
              </NativeAsset>
            )}
            <View style={styles.headerText}>
              <NativeAsset assetType={NativeAssetType.HEADLINE}>
                <Text style={styles.headline} numberOfLines={2}>{nativeAd.headline}</Text>
              </NativeAsset>
              {nativeAd.advertiser && (
                <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                  <Text style={styles.advertiser} numberOfLines={1}>{nativeAd.advertiser}</Text>
                </NativeAsset>
              )}
            </View>
          </View>
          {nativeAd.body && (
            <NativeAsset assetType={NativeAssetType.BODY}>
              <Text style={styles.body} numberOfLines={2}>{nativeAd.body}</Text>
            </NativeAsset>
          )}
          {nativeAd.callToAction && (
            <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
              <Text style={styles.cta}>{nativeAd.callToAction}</Text>
            </NativeAsset>
          )}
        </View>
      </View>
      <Text style={styles.adBadge}>Ad</Text>
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  media: {
    width: 120,
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  headerText: {
    flex: 1,
  },
  headline: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  advertiser: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  adBadge: {
    position: 'absolute',
    top: 4,
    right: 6,
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
  },
  body: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  cta: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 7,
    overflow: 'hidden',
  },
});
