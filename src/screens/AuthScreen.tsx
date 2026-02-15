import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/hooks/useAuthStore';
import { colors } from '@/theme';
import type { AuthScreenProps } from '@/navigation/types';

type AuthMode = 'landing' | 'login' | 'register' | 'emailLink' | 'emailLinkSent';

export const AuthScreen = ({ navigation }: AuthScreenProps) => {
  const [mode, setMode] = useState<AuthMode>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendSignInLink, continueAsGuest } = useAuthStore();

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error('[Auth] Google sign-in failed:', error);
      if (error?.code !== 'SIGN_IN_CANCELLED') {
        Alert.alert('Sign In Failed', error?.message || 'Could not sign in with Google. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    setIsLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (error: any) {
      console.error('[Auth] Email login failed:', error);
      const msg = error?.code === 'auth/invalid-credential'
        ? 'Invalid email or password.'
        : error?.message || 'Could not sign in. Please try again.';
      Alert.alert('Sign In Failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailRegister = async () => {
    if (!email || !password || !displayName) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    setIsLoading(true);
    try {
      await signUpWithEmail(email, password, displayName);
    } catch (error: any) {
      console.error('[Auth] Email register failed:', error);
      Alert.alert('Registration Failed', error?.message || 'Could not create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuest = async () => {
    setIsLoading(true);
    try {
      await continueAsGuest();
    } catch (error: any) {
      console.error('[Auth] Guest sign-in failed:', error);
      Alert.alert('Error', 'Could not continue as guest. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendEmailLink = async () => {
    if (!email) {
      Alert.alert('Missing Email', 'Please enter your email address.');
      return;
    }
    setIsLoading(true);
    try {
      await sendSignInLink(email);
      setMode('emailLinkSent');
    } catch (error: any) {
      console.error('[Auth] Send email link failed:', error);
      Alert.alert('Error', error?.message || 'Could not send sign-in link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === 'emailLinkSent') {
    return (
      <View style={[styles.formContainer, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <View style={styles.emailLinkSentContent}>
          <Text style={styles.emailLinkIcon}>{'✉️'}</Text>
          <Text style={styles.formTitle}>Check your email</Text>
          <Text style={styles.emailLinkDesc}>
            We sent a sign-in link to{'\n'}
            <Text style={styles.emailLinkEmail}>{email}</Text>
          </Text>
          <Text style={styles.emailLinkHint}>
            Tap the link in the email to sign in. You can close this screen — the app will open automatically when you tap the link.
          </Text>
          <TouchableOpacity
            style={styles.emailLinkResendBtn}
            onPress={handleSendEmailLink}
            disabled={isLoading}
          >
            <Text style={styles.emailLinkResendText}>Resend link</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => { setMode('landing'); setEmail(''); }}
          >
            <Text style={styles.backBtnText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (mode === 'landing') {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.topBg} />
        <View style={styles.bottomBg} />
        <View style={styles.imageContainer}>
          <Image
            source={require('../../assets/duet-home-bg.png')}
            style={styles.bgImage}
            resizeMode="contain"
          />
        </View>
        <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <Image
              source={require('../../assets/duet-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Duet</Text>
            <Text style={styles.tagline}>
              Always-on voice connection.{'\n'}Together, even when apart.
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleGoogleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.googleBtnText}>Sign in with Google</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.emailBtn}
              onPress={() => setMode('emailLink')}
              disabled={isLoading}
            >
              <Text style={styles.emailBtnText}>Sign in with Email Link</Text>
            </TouchableOpacity>
            <View style={styles.textLinks}>
              <TouchableOpacity
                onPress={() => setMode('login')}
                disabled={isLoading}
              >
                <Text style={styles.registerLinkText}>Sign in with Password</Text>
              </TouchableOpacity>
              <Text style={styles.linkSeparator}>|</Text>
              <TouchableOpacity
                onPress={() => setMode('register')}
                disabled={isLoading}
              >
                <Text style={styles.registerLinkText}>Create Account</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.guestLink}
              onPress={handleGuest}
              disabled={isLoading}
            >
              <Text style={styles.guestLinkText}>Continue as Guest</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Email Link form (passwordless)
  if (mode === 'emailLink') {
    return (
      <View style={[styles.formContainer, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={[styles.formScroll, { paddingBottom: insets.bottom + 20 }]}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity style={styles.backBtn} onPress={() => setMode('landing')}>
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>

            <Text style={styles.formTitle}>Passwordless Sign In</Text>
            <Text style={styles.formSubtitle}>
              Enter your email and we'll send you a sign-in link. No password needed.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSendEmailLink}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.submitBtnText}>Send Sign-In Link</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchMode}
              onPress={() => setMode('login')}
            >
              <Text style={styles.switchModeText}>Prefer to use a password? Sign in here</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // Login or Register form
  return (
    <View style={[styles.formContainer, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.formScroll, { paddingBottom: insets.bottom + 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => setMode('landing')}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.formTitle}>
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </Text>
          <Text style={styles.formSubtitle}>
            {mode === 'login' ? 'Sign in to your Duet account' : 'Join Duet to stay connected'}
          </Text>

          {mode === 'register' && (
            <TextInput
              style={styles.input}
              placeholder="Display Name"
              placeholderTextColor={colors.textMuted}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.submitBtn}
            onPress={mode === 'login' ? handleEmailLogin : handleEmailRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.submitBtnText}>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchMode}
            onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            <Text style={styles.switchModeText}>
              {mode === 'login'
                ? "Don't have an account? Create one"
                : 'Already have an account? Sign in'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  topBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#1a293d',
  },
  bottomBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#f4dbc8',
  },
  imageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    paddingTop: 16,
  },
  logo: {
    width: 60,
    height: 56,
    tintColor: '#e8734a',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 4,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  buttons: {
    paddingHorizontal: 32,
    paddingBottom: 40,
    gap: 12,
  },
  googleBtn: {
    backgroundColor: '#e8734a',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
  },
  googleBtnText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  emailBtn: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3d3d50',
  },
  emailBtnText: {
    color: '#3d3d50',
    fontSize: 18,
    fontWeight: '600',
  },
  textLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  registerLinkText: {
    color: '#1a293d',
    fontSize: 15,
    fontWeight: '600',
  },
  linkSeparator: {
    color: '#1a293d',
    fontSize: 15,
    opacity: 0.4,
  },
  guestLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  guestLinkText: {
    color: '#1a293d',
    fontSize: 14,
    fontWeight: '500',
  },
  formContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  formScroll: {
    flexGrow: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    gap: 16,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  backBtnText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  formTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  formSubtitle: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  switchMode: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchModeText: {
    color: colors.primaryLight,
    fontSize: 14,
  },
  emailLinkSentContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  emailLinkIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emailLinkDesc: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
  emailLinkEmail: {
    color: colors.text,
    fontWeight: '600',
  },
  emailLinkHint: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  emailLinkResendBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 16,
  },
  emailLinkResendText: {
    color: colors.primaryLight,
    fontSize: 15,
    fontWeight: '500',
  },
});
