import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EMAIL_LINK_STORAGE_KEY = 'emailForSignIn';

export interface UserProfile {
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: number;
  authProvider: 'google' | 'email' | 'anonymous';
}

class AuthService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const webClientId = Constants.expirationDate
      ? '' // Expo Go fallback
      : Constants.expoConfig?.extra?.googleWebClientId || '';

    if (webClientId) {
      GoogleSignin.configure({ webClientId });
    }

    this.initialized = true;
  }

  async signInWithGoogle(): Promise<FirebaseAuthTypes.User> {
    await GoogleSignin.hasPlayServices();
    const signInResult = await GoogleSignin.signIn();
    const idToken = (signInResult as any).idToken ?? (signInResult as any).data?.idToken;
    if (!idToken) throw new Error('Google Sign-In failed: no ID token');

    const googleCredential = auth.GoogleAuthProvider.credential(idToken);

    // If currently anonymous, link the account to preserve data
    const currentUser = auth().currentUser;
    if (currentUser?.isAnonymous) {
      try {
        const result = await currentUser.linkWithCredential(googleCredential);
        await this.createOrUpdateProfile(result.user, 'google');
        return result.user;
      } catch (linkError: any) {
        // If account already exists, sign in directly
        if (linkError.code === 'auth/credential-already-in-use') {
          const result = await auth().signInWithCredential(googleCredential);
          await this.createOrUpdateProfile(result.user, 'google');
          return result.user;
        }
        throw linkError;
      }
    }

    const result = await auth().signInWithCredential(googleCredential);
    await this.createOrUpdateProfile(result.user, 'google');
    return result.user;
  }

  async signUpWithEmail(email: string, password: string, displayName: string): Promise<FirebaseAuthTypes.User> {
    const currentUser = auth().currentUser;

    if (currentUser?.isAnonymous) {
      const emailCredential = auth.EmailAuthProvider.credential(email, password);
      try {
        const result = await currentUser.linkWithCredential(emailCredential);
        await result.user.updateProfile({ displayName });
        await result.user.reload();
        await this.createOrUpdateProfile(auth().currentUser!, 'email');
        return auth().currentUser!;
      } catch (linkError: any) {
        if (linkError.code === 'auth/email-already-in-use') {
          throw new Error('An account with this email already exists. Please sign in instead.');
        }
        throw linkError;
      }
    }

    const result = await auth().createUserWithEmailAndPassword(email, password);
    await result.user.updateProfile({ displayName });
    await result.user.reload();
    await this.createOrUpdateProfile(auth().currentUser!, 'email');
    return auth().currentUser!;
  }

  async signInWithEmail(email: string, password: string): Promise<FirebaseAuthTypes.User> {
    const result = await auth().signInWithEmailAndPassword(email, password);
    return result.user;
  }

  async continueAsGuest(): Promise<FirebaseAuthTypes.User> {
    const result = await auth().signInAnonymously();
    await this.createOrUpdateProfile(result.user, 'anonymous');
    return result.user;
  }

  private async createOrUpdateProfile(
    user: FirebaseAuthTypes.User,
    provider: 'google' | 'email' | 'anonymous'
  ): Promise<void> {
    const profileRef = database().ref(`/users/${user.uid}/profile`);
    const existing = await profileRef.once('value');

    if (!existing.exists()) {
      await profileRef.set({
        displayName: user.displayName || 'Duet User',
        email: user.email || null,
        avatarUrl: user.photoURL || null,
        createdAt: database.ServerValue.TIMESTAMP,
        authProvider: provider,
      });
    } else {
      const updates: Record<string, any> = { authProvider: provider };
      if (user.displayName) updates.displayName = user.displayName;
      if (user.email) updates.email = user.email;
      if (user.photoURL && !existing.val().avatarUrl) updates.avatarUrl = user.photoURL;
      await profileRef.update(updates);
    }
  }

  async sendSignInLink(email: string): Promise<void> {
    const actionCodeSettings = {
      url: 'https://duet-33cf5.firebaseapp.com/auth/action',
      handleCodeInApp: true,
      iOS: { bundleId: 'com.duet.app' },
      android: { packageName: 'com.duet.app', installApp: true, minimumVersion: '21' },
    };

    await auth().sendSignInLinkToEmail(email, actionCodeSettings);
    await AsyncStorage.setItem(EMAIL_LINK_STORAGE_KEY, email);
  }

  isSignInWithEmailLink(url: string): boolean {
    return auth().isSignInWithEmailLink(url);
  }

  async completeSignInWithEmailLink(url: string, promptedEmail?: string): Promise<FirebaseAuthTypes.User> {
    const email = promptedEmail || await AsyncStorage.getItem(EMAIL_LINK_STORAGE_KEY);
    if (!email) {
      throw new Error('EMAIL_REQUIRED');
    }

    const currentUser = auth().currentUser;

    if (currentUser?.isAnonymous) {
      const emailCredential = auth.EmailAuthProvider.credentialWithLink(email, url);
      try {
        const result = await currentUser.linkWithCredential(emailCredential);
        await result.user.updateProfile({ displayName: email.split('@')[0] });
        await this.createOrUpdateProfile(result.user, 'email');
        await AsyncStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
        return result.user;
      } catch (linkError: any) {
        if (linkError.code === 'auth/credential-already-in-use') {
          const result = await auth().signInWithEmailLink(email, url);
          await this.createOrUpdateProfile(result.user, 'email');
          await AsyncStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
          return result.user;
        }
        throw linkError;
      }
    }

    const result = await auth().signInWithEmailLink(email, url);
    await this.createOrUpdateProfile(result.user, 'email');
    await AsyncStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
    return result.user;
  }

  async getPendingSignInEmail(): Promise<string | null> {
    return AsyncStorage.getItem(EMAIL_LINK_STORAGE_KEY);
  }

  async clearPendingSignInEmail(): Promise<void> {
    await AsyncStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
  }

  onAuthStateChanged(callback: (user: FirebaseAuthTypes.User | null) => void): () => void {
    return auth().onAuthStateChanged(callback);
  }

  async signOut(): Promise<void> {
    try { await GoogleSignin.signOut(); } catch {}
    await auth().signOut();
  }

  getCurrentUser(): FirebaseAuthTypes.User | null {
    return auth().currentUser;
  }

  isAnonymous(): boolean {
    return auth().currentUser?.isAnonymous ?? true;
  }

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const snap = await database().ref(`/users/${uid}/profile`).once('value');
    return snap.val();
  }
}

export const authService = new AuthService();
