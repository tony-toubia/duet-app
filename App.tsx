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

if (Platform.OS === 'android') {
  AppRegistry.registerHeadlessTask('DuetKeepAlive', () => async () => {
    return new Promise<void>(() => {});
  });
}

// Lazy-load the full app to catch import-time errors
let RootNavigator: any = null;
let NavigationContainer: any = null;
let SafeAreaProvider: any = null;
let navigationRef: any = null;
let importError: string | null = null;

try {
  NavigationContainer = require('@react-navigation/native').NavigationContainer;
  SafeAreaProvider = require('react-native-safe-area-context').SafeAreaProvider;
  navigationRef = require('./src/navigation/navigationRef').navigationRef;
  RootNavigator = require('./src/navigation/RootNavigator').RootNavigator;
} catch (e: any) {
  importError = `Import error: ${e?.message || String(e)}\n\nStack: ${e?.stack || 'none'}`;
}

export default function App() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show import error on red screen
  if (importError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#ff0000', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}>BUILD 68 IMPORT ERROR</Text>
        <Text style={{ color: '#fff', fontSize: 12, marginTop: 10 }}>{importError}</Text>
      </View>
    );
  }

  // Show mounted indicator first
  if (!mounted) {
    return (
      <View style={{ flex: 1, backgroundColor: '#00ff00', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#000', fontSize: 24, fontWeight: 'bold' }}>BUILD 68 — FIRST RENDER</Text>
      </View>
    );
  }

  // Full app
  try {
    return (
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef}>
          <RootNavigator />
        </NavigationContainer>
        <View style={{ position: 'absolute', top: 50, left: 10, right: 10, backgroundColor: 'rgba(0,255,0,0.9)', padding: 8, borderRadius: 8, zIndex: 9999 }} pointerEvents="none">
          <Text style={{ color: '#000', fontSize: 14, fontWeight: 'bold' }}>BUILD 68 — Full app rendered</Text>
        </View>
      </SafeAreaProvider>
    );
  } catch (e: any) {
    return (
      <View style={{ flex: 1, backgroundColor: '#ff6600', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}>BUILD 68 RENDER ERROR</Text>
        <Text style={{ color: '#fff', fontSize: 12, marginTop: 10 }}>{e?.message || String(e)}</Text>
      </View>
    );
  }
}
