import './fixRCTEventEmitter';

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

console.error('[DIAG] App.tsx executing');

export default function App() {
  console.error('[DIAG] App component rendering');
  return (
    <View style={styles.container}>
      <Text style={styles.title}>DUET iOS 26</Text>
      <Text style={styles.subtitle}>React Native is rendering!</Text>
      <Text style={styles.info}>Build 43 - JSC Diagnostic</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF0000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 24,
    color: '#FFFFFF',
    marginTop: 16,
  },
  info: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 32,
    opacity: 0.8,
  },
});
