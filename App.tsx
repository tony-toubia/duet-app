import './fixRCTEventEmitter';
import './fixFabricCompat';
(globalThis as any).RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

import 'react-native-gesture-handler'; // Required by @react-navigation/stack

import React from 'react';
import { Platform, AppRegistry } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';

if (Platform.OS === 'android') {
  AppRegistry.registerHeadlessTask('DuetKeepAlive', () => async () => {
    console.log('[DuetKeepAlive] Headless task started');
    return new Promise<void>(() => {});
  });
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
