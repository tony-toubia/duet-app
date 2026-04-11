import './fixRCTEventEmitter';
import './fixFabricCompat';
(globalThis as any).RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

// === BUILD 71: ErrorBoundary only (no SafeAreaProvider) to isolate ===
import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
enableScreens(false);

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const Stack = createStackNavigator();

function GreenScreen() {
  return (
    <View style={styles.green}>
      <Text style={styles.text}>BUILD 71</Text>
      <Text style={styles.sub}>ErrorBoundary only — no SafeAreaProvider</Text>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <ErrorBoundary>
        <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false }} detachInactiveScreens={false}>
          <Stack.Screen name="Test" component={GreenScreen} />
        </Stack.Navigator>
      </ErrorBoundary>
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
