import './fixRCTEventEmitter';
(globalThis as any).RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, AppRegistry, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

if (Platform.OS === 'android') {
  AppRegistry.registerHeadlessTask('DuetKeepAlive', () => async () => {
    return new Promise<void>(() => {});
  });
}

const Stack = createNativeStackNavigator();

function TestScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#00AA00', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 36, color: '#FFF', fontWeight: 'bold' }}>NAV WORKS!</Text>
      <Text style={{ fontSize: 20, color: '#FFF', marginTop: 12 }}>Build 45 - NativeStack test</Text>
    </View>
  );
}

function DiagnosticApp() {
  const [phase, setPhase] = useState<'plain' | 'nav'>('plain');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (phase === 'nav') {
    return (
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Test" component={TestScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Build 45 Diag</Text>
      <Text style={styles.status}>Phase: {phase}</Text>
      <Text style={styles.status}>Elapsed: {elapsed}s</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setPhase('nav')}
      >
        <Text style={styles.buttonText}>Test Navigation</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function App() {
  return <DiagnosticApp />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  status: {
    fontSize: 20,
    color: '#00FF00',
    marginBottom: 8,
  },
  button: {
    marginTop: 30,
    backgroundColor: '#FF0000',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
