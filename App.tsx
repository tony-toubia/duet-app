// DIAGNOSTIC BUILD — minimal app to test React Native rendering on iOS 26
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>DUET DIAGNOSTIC</Text>
      <Text style={styles.sub}>If you see this, React Native rendering works on iOS 26.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ff0000', justifyContent: 'center', alignItems: 'center' },
  text: { color: '#ffffff', fontSize: 32, fontWeight: 'bold' },
  sub: { color: '#ffffff', fontSize: 16, marginTop: 12, textAlign: 'center', paddingHorizontal: 40 },
});
