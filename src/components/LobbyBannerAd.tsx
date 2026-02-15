import React, { useState } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import Constants from 'expo-constants';

const getBannerAdUnitId = () => {
  if (__DEV__) return TestIds.BANNER;
  const extras = Constants.expoConfig?.extra;
  const id = Platform.OS === 'ios' ? extras?.admobBannerIdIos : extras?.admobBannerIdAndroid;
  console.log('[Ad] Banner unit ID:', id ? '(set)' : '(missing)', 'Platform:', Platform.OS);
  return id || TestIds.BANNER;
};

const BANNER_AD_UNIT_ID = getBannerAdUnitId();

export const LobbyBannerAd = () => {
  const [adError, setAdError] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={() => {
          console.log('[Ad] Banner loaded successfully');
          setAdError(null);
        }}
        onAdFailedToLoad={(error) => {
          console.log('[Ad] Banner failed to load:', error);
          setAdError(error.message);
        }}
      />
      {__DEV__ && adError && (
        <Text style={styles.debugText}>Ad error: {adError}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  debugText: {
    color: '#ff6b6b',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
});
