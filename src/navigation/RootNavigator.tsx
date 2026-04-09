import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, View } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthScreen } from '@/screens/AuthScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { LobbyScreen } from '@/screens/LobbyScreen';
import { RoomScreen } from '@/screens/RoomScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { FriendsScreen } from '@/screens/FriendsScreen';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useDuetStore } from '@/hooks/useDuetStore';
import { authService } from '@/services/AuthService';
import { presenceService } from '@/services/PresenceService';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { colors } from '@/theme';
import { RootStackParamList } from './types';
import { parseDeepLink } from './deepLinkParser';
import { navigationRef } from './navigationRef';

const Stack = createStackNavigator<RootStackParamList>();

function navigateFromDeepLink(action: { screen: string; params?: any }) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(action.screen as any, action.params);
  } else {
    const check = setInterval(() => {
      if (navigationRef.isReady()) {
        clearInterval(check);
        navigationRef.navigate(action.screen as any, action.params);
      }
    }, 100);
    setTimeout(() => clearInterval(check), 5000);
  }
}

export const RootNavigator = () => {
  const { user, isLoading, initializeAuth } = useAuthStore();
  const pendingAlert = useDuetStore((s) => s.pendingAlert);
  const dismissAlert = useDuetStore((s) => s.dismissAlert);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = initializeAuth();
    return unsubscribe;
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('onboardingComplete').then((value) => {
      setShowOnboarding(value !== 'true');
    });
  }, []);

  // Set up presence tracking when user is authenticated
  useEffect(() => {
    if (user) {
      const cleanup = presenceService.setup();
      return cleanup;
    }
  }, [user]);

  // Handle deep links
  useEffect(() => {
    const { completeSignInWithEmailLink } = useAuthStore.getState();

    const handleUrl = async (url: string) => {
      // 1. Check for Firebase email sign-in link first
      if (await authService.isSignInWithEmailLink(url)) {
        try {
          await completeSignInWithEmailLink(url);
        } catch (error: any) {
          if (error.message === 'EMAIL_REQUIRED') {
            if (Platform.OS === 'ios') {
              Alert.prompt(
                'Confirm Email',
                'Enter the email address used to request the sign-in link.',
                async (promptedEmail) => {
                  if (promptedEmail) {
                    try {
                      await completeSignInWithEmailLink(url, promptedEmail);
                    } catch (e: any) {
                      Alert.alert('Sign In Failed', e?.message || 'Could not complete sign-in.');
                    }
                  }
                }
              );
            } else {
              Alert.alert(
                'Email Required',
                'Please open the sign-in link on the same device where you requested it.',
              );
            }
          } else {
            Alert.alert('Sign In Failed', error?.message || 'Could not complete sign-in.');
          }
        }
        return;
      }

      // 2. Parse as a deep link (duet:// or http(s)://)
      const action = parseDeepLink(url);
      if (!action) return;

      if ('type' in action && action.type === 'external') {
        Linking.openURL(action.url);
        return;
      }

      if ('screen' in action) {
        navigateFromDeepLink(action);
      }
    };

    // Cold start: app opened from a link
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // Warm start: link arrives while app is running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => subscription.remove();
  }, []);

  if (isLoading || showOnboarding === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            <>
              <Stack.Screen name="Lobby" component={LobbyScreen} />
              <Stack.Screen name="Room" component={RoomScreen} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen name="Friends" component={FriendsScreen} />
            </>
          ) : showOnboarding ? (
            <>
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              <Stack.Screen name="Auth" component={AuthScreen} />
            </>
          ) : (
            <Stack.Screen name="Auth" component={AuthScreen} />
          )}
        </Stack.Navigator>
        {pendingAlert && (
          <ConfirmModal
            visible={true}
            title={pendingAlert.title}
            message={pendingAlert.message}
            buttons={pendingAlert.buttons.map((btn) => ({
              ...btn,
              onPress: () => {
                btn.onPress?.();
                dismissAlert();
              },
            }))}
            onClose={dismissAlert}
          />
        )}
      </>
    </ErrorBoundary>
  );
};
