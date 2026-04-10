import './fixRCTEventEmitter';
import './fixFabricCompat';
(globalThis as any).RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

// === BUILD 60: DIAGNOSTIC — NavigationContainer only, no Stack ===
// Build 59 proved imports are safe. Now test if NavigationContainer renders.
import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
enableScreens(false);

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Keep Stack import evaluated but don't use it yet
const _stack = createStackNavigator;

export default function App() {
  return (
    <NavigationContainer>
      <View style={styles.green}>
        <Text style={styles.text}>BUILD 60 — NavigationContainer ONLY</Text>
        <Text style={styles.sub}>If you see this, NavigationContainer renders on iOS 26</Text>
      </View>
    </NavigationContainer>
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
