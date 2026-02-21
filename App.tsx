// Silence Firebase v22+ modular API deprecation warnings (namespaced API still works)
// TODO: Migrate to modular API and remove this flag
(globalThis as any).RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
