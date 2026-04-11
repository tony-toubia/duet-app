import './fixRCTEventEmitter';
import './fixFabricCompat';
(globalThis as any).RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

// iOS 26: Must import gesture handler before navigation
import 'react-native-gesture-handler';
// iOS 26: Disable native screen containers (they crash due to Fabric false-positive)
import { enableScreens } from 'react-native-screens';
enableScreens(false);

import React, { useState, useEffect } from 'react';
import { Platform, AppRegistry, View, Text } from 'react-native';
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
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#ff0000', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>BUILD 67 ERROR</Text>
        <Text style={{ color: '#fff', fontSize: 14, marginTop: 10 }}>{error}</Text>
      </View>
    );
  }

  try {
    return (
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef}>
          <RootNavigator />
        </NavigationContainer>
        {/* Diagnostic overlay — remove after debugging */}
        {mounted && (
          <View style={{ position: 'absolute', top: 50, left: 10, right: 10, backgroundColor: 'rgba(0,255,0,0.9)', padding: 8, borderRadius: 8, zIndex: 9999 }} pointerEvents="none">
            <Text style={{ color: '#000', fontSize: 14, fontWeight: 'bold' }}>BUILD 67 — App mounted OK</Text>
          </View>
        )}
      </SafeAreaProvider>
    );
  } catch (e: any) {
    return (
      <View style={{ flex: 1, backgroundColor: '#ff0000', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>BUILD 67 RENDER ERROR</Text>
        <Text style={{ color: '#fff', fontSize: 14, marginTop: 10 }}>{e?.message || String(e)}</Text>
      </View>
    );
  }
}
