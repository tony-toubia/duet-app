import './fixRCTEventEmitter';
import './fixFabricCompat';
(globalThis as any).RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

// iOS 26: Must import gesture handler before navigation
import 'react-native-gesture-handler';
// iOS 26: Disable native screen containers (they crash due to Fabric false-positive)
import { enableScreens } from 'react-native-screens';
enableScreens(false);

import React from 'react';
import { Dimensions, Platform, AppRegistry } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import notifee from '@notifee/react-native';

notifee.registerForegroundService((notification) => {
  return new Promise(() => {
    console.log('[ForegroundService] running for background audio');
  });
});

if (Platform.OS === 'android') {
  AppRegistry.registerHeadlessTask('DuetKeepAlive', () => async () => {
    console.log('[DuetKeepAlive] Headless task started');
    return new Promise<void>(() => {});
  });
}

// iOS 26: SafeAreaProvider's native onInsetsChange event doesn't fire,
// so without initialMetrics the children never render (insets stays null).
// Provide fallback metrics so children render immediately.
const { width, height } = Dimensions.get('window');
const safeAreaMetrics = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width, height },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <NavigationContainer ref={navigationRef}>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
