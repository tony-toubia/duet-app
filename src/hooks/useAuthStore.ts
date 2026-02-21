import { create } from 'zustand';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import { authService, UserProfile } from '@/services/AuthService';
import { eventTrackingService } from '@/services/EventTrackingService';

export interface NotificationPreferences {
  emailOptIn: boolean;
  pushOptIn: boolean;
}

interface AuthState {
  user: FirebaseAuthTypes.User | null;
  userProfile: UserProfile | null;
  preferences: NotificationPreferences;
  isLoading: boolean;
  isGuest: boolean;
  emailLinkSent: boolean;
  emailLinkEmail: string | null;

  // Actions
  initializeAuth: () => () => void;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  sendSignInLink: (email: string) => Promise<void>;
  completeSignInWithEmailLink: (url: string, email?: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  userProfile: null,
  preferences: { emailOptIn: true, pushOptIn: true },
  isLoading: true,
  isGuest: false,
  emailLinkSent: false,
  emailLinkEmail: null,

  initializeAuth: () => {
    authService.initialize();

    const unsubscribe = authService.onAuthStateChanged(async (user) => {
      if (user) {
        set({
          user,
          isGuest: user.isAnonymous,
          isLoading: false,
        });
        // Track login/session
        eventTrackingService.track('session_start');
        if (!user.isAnonymous) {
          eventTrackingService.track('login', {
            provider: user.providerData?.[0]?.providerId || 'unknown',
          });
        }
        // Ensure profile exists (creates if needed, with retry for RTDB auth lag)
        await authService.ensureProfile(user);
        const [profile, prefsSnap] = await Promise.all([
          authService.getUserProfile(user.uid),
          database().ref(`/users/${user.uid}/preferences`).once('value'),
        ]);
        if (get().user?.uid === user.uid) {
          const prefsVal = prefsSnap.val();
          set({
            userProfile: profile,
            preferences: {
              emailOptIn: prefsVal?.emailOptIn !== false,
              pushOptIn: prefsVal?.pushOptIn !== false,
            },
          });
        }
      } else {
        set({
          user: null,
          userProfile: null,
          isGuest: false,
          isLoading: false,
        });
      }
    });

    return unsubscribe;
  },

  signInWithGoogle: async () => {
    set({ isLoading: true });
    try {
      const user = await authService.signInWithGoogle();
      // Set temporary profile from Firebase User object for immediate UI
      set({
        user,
        isGuest: false,
        isLoading: false,
        userProfile: {
          displayName: user.displayName || 'Duet User',
          email: user.email || null,
          avatarUrl: user.photoURL || null,
          createdAt: Date.now(),
          authProvider: 'google',
        },
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signUpWithEmail: async (email, password, displayName) => {
    set({ isLoading: true });
    try {
      const user = await authService.signUpWithEmail(email, password, displayName);
      set({
        user,
        isGuest: false,
        isLoading: false,
        userProfile: {
          displayName: displayName || 'Duet User',
          email: user.email || null,
          avatarUrl: null,
          createdAt: Date.now(),
          authProvider: 'email',
        },
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signInWithEmail: async (email, password) => {
    set({ isLoading: true });
    try {
      const user = await authService.signInWithEmail(email, password);
      set({
        user,
        isGuest: false,
        isLoading: false,
        userProfile: {
          displayName: user.displayName || 'Duet User',
          email: user.email || null,
          avatarUrl: user.photoURL || null,
          createdAt: Date.now(),
          authProvider: 'email',
        },
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  sendSignInLink: async (email) => {
    await authService.sendSignInLink(email);
    set({ emailLinkSent: true, emailLinkEmail: email });
  },

  completeSignInWithEmailLink: async (url, email) => {
    set({ isLoading: true });
    try {
      const user = await authService.completeSignInWithEmailLink(url, email);
      const profile = await authService.getUserProfile(user.uid);
      set({ user, userProfile: profile, isGuest: false, isLoading: false, emailLinkSent: false, emailLinkEmail: null });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  continueAsGuest: async () => {
    set({ isLoading: true });
    try {
      const user = await authService.continueAsGuest();
      set({ user, userProfile: null, isGuest: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signOut: async () => {
    await authService.signOut();
    set({ user: null, userProfile: null, isGuest: false, preferences: { emailOptIn: true, pushOptIn: true } });
  },

  refreshProfile: async () => {
    const { user } = get();
    if (user) {
      const [profile, prefsSnap] = await Promise.all([
        authService.getUserProfile(user.uid),
        database().ref(`/users/${user.uid}/preferences`).once('value'),
      ]);
      const prefsVal = prefsSnap.val();
      set({
        userProfile: profile,
        preferences: {
          emailOptIn: prefsVal?.emailOptIn !== false,
          pushOptIn: prefsVal?.pushOptIn !== false,
        },
      });
    }
  },

  updatePreferences: async (prefs) => {
    const { user, preferences } = get();
    if (!user) return;
    const updated = { ...preferences, ...prefs };
    set({ preferences: updated });
    await database().ref(`/users/${user.uid}/preferences`).update(prefs);
  },
}));
