import './fixRCTEventEmitter';
import './fixFabricCompat';
(globalThis as any).RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

// === BUILD 59: DIAGNOSTIC — all imports, NO navigation rendering ===
// Goal: isolate whether SIGKILL comes from module initialization or rendering
import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
enableScreens(false);

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Import navigation but DON'T render it
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Force these to be evaluated (prevent tree-shaking)
const _nav = NavigationContainer;
const _stack = createStackNavigator;

export default function App() {
  return (
    <View style={styles.green}>
      <Text style={styles.text}>BUILD 59 — ALL IMPORTS, NO NAV RENDER</Text>
      <Text style={styles.sub}>If you see this, module initialization is safe on iOS 26</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  green: {
    flex: 1,
    backgroundColor: '#00ff00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  sub: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
  },
});
