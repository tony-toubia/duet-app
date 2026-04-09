import './fixRCTEventEmitter';
(globalThis as any).RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

import 'react-native-gesture-handler';

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.red}>
      <Text style={styles.text}>BUILD 50 — Gesture Handler Import Test</Text>
      <Text style={styles.sub}>If you see this, react-native-gesture-handler import is safe on iOS 26</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  red: {
    flex: 1,
    backgroundColor: '#ff0000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  sub: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
  },
});
