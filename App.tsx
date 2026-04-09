import './fixRCTEventEmitter';
(globalThis as any).RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

import 'react-native-gesture-handler';

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

const Stack = createStackNavigator();

// Error boundary that SHOWS the error
class ErrorDisplay extends React.Component<{children: React.ReactNode}, {error: Error | null}> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <ScrollView style={styles.errorContainer} contentContainerStyle={styles.errorContent}>
          <Text style={styles.errorTitle}>BUILD 51 — CAUGHT ERROR</Text>
          <Text style={styles.errorName}>{this.state.error.name}</Text>
          <Text style={styles.errorMsg}>{this.state.error.message}</Text>
          <Text style={styles.errorStack}>{this.state.error.stack}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

function GreenScreen() {
  return (
    <View style={styles.green}>
      <Text style={styles.text}>BUILD 51 — Navigator Working!</Text>
    </View>
  );
}

export default function App() {
  return (
    <ErrorDisplay>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Test" component={GreenScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ErrorDisplay>
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
  errorContainer: {
    flex: 1,
    backgroundColor: '#ff0000',
  },
  errorContent: {
    padding: 40,
    paddingTop: 80,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  errorName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffff00',
    marginBottom: 10,
  },
  errorMsg: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 20,
  },
  errorStack: {
    fontSize: 12,
    color: '#ffcccc',
    fontFamily: 'Courier',
  },
});
