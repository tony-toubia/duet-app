import './fixRCTEventEmitter';
import './fixFabricCompat';
(globalThis as any).RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

// iOS 26: Must import gesture handler before navigation
import 'react-native-gesture-handler';
// iOS 26: Disable native screen containers (they crash due to Fabric false-positive)
import { enableScreens } from 'react-native-screens';
enableScreens(false);

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
