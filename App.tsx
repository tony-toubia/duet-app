import './fixRCTEventEmitter';
(globalThis as any).RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, AppRegistry } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './src/navigation/navigationRef';
import { useAuthStore } from './src/hooks/useAuthStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

if (Platform.OS === 'android') {
  AppRegistry.registerHeadlessTask('DuetKeepAlive', () => async () => {
    return new Promise<void>(() => {});
  });
}

// Diagnostic wrapper that shows auth/loading state on screen
function DiagnosticApp() {
  const { user, isLoading, initializeAuth } = useAuthStore();
  const [steps, setSteps] = useState<string[]>(['App mounted']);
  const [onboarding, setOnboarding] = useState<string>('pending');
  const [elapsed, setElapsed] = useState(0);
  const [showRealApp, setShowRealApp] = useState(false);

  const addStep = (step: string) => {
    setSteps((prev) => [...prev, step]);
  };

  // Timer
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Auth init
  useEffect(() => {
    addStep('Calling initializeAuth...');
    try {
      const unsub = initializeAuth();
      addStep('initializeAuth returned');
      return unsub;
    } catch (e: any) {
      addStep('initializeAuth ERROR: ' + e.message);
    }
  }, []);

  // Watch auth state changes
  useEffect(() => {
    if (!isLoading) {
      addStep(user ? 'Auth resolved: user=' + (user.displayName || user.uid?.slice(0, 8)) : 'Auth resolved: no user');
    }
  }, [isLoading, user]);

  // AsyncStorage check
  useEffect(() => {
    addStep('Reading AsyncStorage...');
    AsyncStorage.getItem('onboardingComplete')
      .then((value) => {
        setOnboarding(value === 'true' ? 'complete' : 'not complete');
        addStep('AsyncStorage done: ' + (value || 'null'));
      })
      .catch((e) => {
        setOnboarding('ERROR');
        addStep('AsyncStorage ERROR: ' + e.message);
      });
  }, []);

  // After 10s, try to show real app regardless
  useEffect(() => {
    if (elapsed >= 10 && !showRealApp) {
      addStep('10s timeout - would show real app now');
    }
  }, [elapsed]);

  // If auth resolves and onboarding is checked, load real app after 3s
  useEffect(() => {
    if (!isLoading && onboarding !== 'pending') {
      const t = setTimeout(() => setShowRealApp(true), 3000);
      return () => clearTimeout(t);
    }
  }, [isLoading, onboarding]);

  if (showRealApp) {
    const { RootNavigator } = require('./src/navigation/RootNavigator');
    return (
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef}>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Build 44 Diag</Text>
      <Text style={styles.status}>
        Auth: {isLoading ? 'LOADING...' : user ? 'SIGNED IN' : 'NO USER'}
      </Text>
      <Text style={styles.status}>Onboarding: {onboarding}</Text>
      <Text style={styles.status}>Elapsed: {elapsed}s</Text>
      <View style={styles.logBox}>
        {steps.map((s, i) => (
          <Text key={i} style={styles.log}>{s}</Text>
        ))}
      </View>
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
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 80,
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
  logBox: {
    marginTop: 20,
    paddingHorizontal: 20,
    width: '100%',
  },
  log: {
    fontSize: 14,
    color: '#AAAAAA',
    marginBottom: 4,
  },
});
