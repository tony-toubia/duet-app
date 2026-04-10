import './fixRCTEventEmitter';
import './fixFabricCompat';
(globalThis as any).RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

// === BUILD 65: detachInactiveScreens=false + useNativeDriver=false ===
// ROOT CAUSE FOUND: CardStack.js defaults detachInactiveScreens=true on iOS,
// which passes enabled:true to MaybeScreen/MaybeScreenContainer, OVERRIDING
// enableScreens(false). Native ScreenNativeComponent renders → crashes on iOS 26.
// Fix: detachInactiveScreens={false} prop + postinstall patch for CardStack.js
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
      <Text style={styles.text}>BUILD 65 — detachInactiveScreens:false</Text>
      <Text style={styles.sub}>If you see this, native screen components were the crash cause!</Text>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false }} detachInactiveScreens={false}>
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
