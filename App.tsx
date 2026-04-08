// Must be the very first import – registers a stub RCTEventEmitter so that
// native view-lifecycle events arriving before React Renderer initialises
// don't crash the app on iOS 26.  See fixRCTEventEmitter.js for details.
import './fixRCTEventEmitter';

// Silence Firebase v22+ modular API deprecation warnings (namespaced API still works)
// TODO: Migrate to modular API and remove this flag
(globalThis as any).RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

import React from 'react';
import { AppRegistry, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';

// Register a HeadlessJsTask that keeps the JS event loop alive on Android
// when the app is backgrounded. The native DuetJsKeepAliveService starts this
// task when the audio engine starts. The returned Promise never resolves —
// it stays active until the service is stopped (when the audio engine stops).
// This prevents onHostPause from removing the Choreographer callback, which
// would halt all NativeEventEmitter events and JS timers.
if (Platform.OS === 'android') {
  AppRegistry.registerHeadlessTask('DuetKeepAlive', () => async () => {
    console.log('[DuetKeepAlive] Headless task started — JS event loop will stay active');
    return new Promise<void>(() => {
      // Never resolves — task stays active until the service is stopped
    });
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
