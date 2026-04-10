import './fixRCTEventEmitter';
import './fixFabricCompat';
(globalThis as any).RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

// === BUILD 61: DIAGNOSTIC — GestureHandlerRootView + PanGestureHandler isolation ===
// Build 60 proved NavigationContainer renders fine.
// Now test if GestureHandlerRootView + PanGestureHandler render without Stack.
import 'react-native-gesture-handler';
import { GestureHandlerRootView, PanGestureHandler } from 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
enableScreens(false);

import React from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

const _stack = createStackNavigator;

export default function App() {
  return (
    <NavigationContainer>
      <GestureHandlerRootView style={{flex: 1}}>
        <PanGestureHandler enabled={false}>
          <Animated.View style={styles.green}>
            <Text style={styles.text}>BUILD 61 — GH RootView + PanGH</Text>
            <Text style={styles.sub}>If you see this, GestureHandler components render on iOS 26</Text>
          </Animated.View>
        </PanGestureHandler>
      </GestureHandlerRootView>
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
