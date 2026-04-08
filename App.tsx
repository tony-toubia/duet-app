// Minimal React imports that we KNOW work on iOS 26
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, AppRegistry } from 'react-native';

let AppContent: React.ComponentType | null = null;
let loadError: string | null = null;
let lastStep = 'init';

function step(label: string) { lastStep = label; }

try {
  step('1: Firebase flag');
  (globalThis as any).RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

  step('3: @react-navigation/native');
  const { NavigationContainer } = require('@react-navigation/native');

  step('4: react-native-safe-area-context');
  const { SafeAreaProvider } = require('react-native-safe-area-context');

  step('5: RootNavigator');
  const { RootNavigator } = require('./src/navigation/RootNavigator');

  step('6: navigationRef');
  const { navigationRef } = require('./src/navigation/navigationRef');

  step('7: building AppContent');
  AppContent = () => (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
} catch (e: any) {
  loadError = `FAILED AT STEP ${lastStep}\n\n${e?.message || String(e)}`;
  if (e?.stack) {
    loadError += '\n\n' + e.stack;
  }
}

export default function App() {
  if (loadError) {
    return (
      <View style={styles.error}>
        <Text style={styles.title}>JS LOAD ERROR</Text>
        <ScrollView style={styles.scroll}>
          <Text style={styles.detail}>{loadError}</Text>
        </ScrollView>
      </View>
    );
  }
  if (AppContent) return <AppContent />;
  return (
    <View style={styles.error}>
      <Text style={styles.title}>NO CONTENT</Text>
      <Text style={styles.detail}>AppContent was null and no error was caught.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  error: { flex: 1, backgroundColor: '#cc0000', padding: 40, paddingTop: 80 },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
  scroll: { flex: 1 },
  detail: { color: '#fff', fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
