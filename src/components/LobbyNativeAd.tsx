import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaAspectRatio,
  TestIds,
} from 'react-native-google-mobile-ads';
import Constants from 'expo-constants';

const getLobbyNativeAdUnitId = () => {
  if (__DEV__) return TestIds.NATIVE;
  const extras = Constants.expoConfig?.extra;
  const id = Platform.OS === 'ios' ? extras?.admobLobbyNativeIdIos : extras?.admobLobbyNativeIdAndroid;
  console.log('[Ad] Lobby native unit ID:', id ? '(set)' : '(missing)', 'Platform:', Platform.OS);
  return id || TestIds.NATIVE;
};

const LOBBY_NATIVE_AD_UNIT_ID = getLobbyNativeAdUnitId();

export const LobbyNativeAd = () => {
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);

  useEffect(() => {
    let destroyed = false;
    let ad: NativeAd | null = null;

    NativeAd.createForAdRequest(LOBBY_NATIVE_AD_UNIT_ID, {
      aspectRatio: NativeMediaAspectRatio.LANDSCAPE,
    })
      .then((loadedAd) => {
        if (!destroyed) {
          ad = loadedAd;
          setNativeAd(loadedAd);
          console.log('[Ad] Lobby native ad loaded');
        } else {
          loadedAd.destroy();
        }
      })
      .catch((err) => {
        console.log('[Ad] Lobby native ad failed to load:', err.message);
      });

    return () => {
      destroyed = true;
      ad?.destroy();
    };
  }, []);

  if (!nativeAd) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Ad</Text>
      </View>
    );
  }

  return (
    <NativeAdView nativeAd={nativeAd} style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.adBadge}>Ad</Text>
        {nativeAd.icon && (
          <NativeAsset assetType={NativeAssetType.ICON}>
            <Image source={{ uri: nativeAd.icon.url }} style={styles.icon} />
          </NativeAsset>
        )}
        <View style={styles.content}>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text style={styles.headline} numberOfLines={1}>{nativeAd.headline}</Text>
          </NativeAsset>
          {nativeAd.body && (
            <NativeAsset assetType={NativeAssetType.BODY}>
              <Text style={styles.body} numberOfLines={1}>{nativeAd.body}</Text>
            </NativeAsset>
          )}
        </View>
        {nativeAd.callToAction && (
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <Text style={styles.cta}>{nativeAd.callToAction}</Text>
          </NativeAsset>
        )}
      </View>
    </NativeAdView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    marginHorizontal: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  content: {
    flex: 1,
  },
  headline: {
    color: '#3d3d50',
    fontSize: 13,
    fontWeight: '600',
  },
  body: {
    color: '#6b6b80',
    fontSize: 11,
    marginTop: 1,
  },
  cta: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: '#e8734a',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  adBadge: {
    color: '#9a9aaa',
    fontSize: 9,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#c0c0cc',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  placeholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 8,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: 'rgba(255, 255, 255, 0.2)',
    fontSize: 10,
    fontWeight: '600',
  },
});
