import './fixRCTEventEmitter';
import './fixFabricCompat';
(globalThis as any).RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

// === BUILD 63: Stack.Navigator with gestureEnabled: false ===
// Build 62 crashed. Theory: Card's Animated.event with useNativeDriver:true
// creates NATIVE_ANIMATED_EVENT action type in PanGestureHandler, which crashes.
// gestureEnabled:false makes onGestureEvent=undefined, bypassing native driver.
import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
enableScreens(false);

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

const Stack = createStackNavigator();

function GreenScreen() {
  return (
    <View style={styles.green}>
      <Text style={styles.text}>BUILD 63 — Stack + gestureEnabled:false</Text>
      <Text style={styles.sub}>If you see this, native animated gesture events were the problem!</Text>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false }}>
        <Stack.Screen name="Test" component={GreenScreen} />
      </Stack.Navigator>
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
