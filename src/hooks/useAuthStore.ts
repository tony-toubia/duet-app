import { create } from 'zustand';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { authService, UserProfile } from '@/services/AuthService';

interface AuthState {
  user: FirebaseAuthTypes.User | null;
  userProfile: UserProfile | null;
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
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  userProfile: null,
  isLoading: true,
  isGuest: false,
  emailLinkSent: false,
  emailLinkEmail: null,

  initializeAuth: () => {
    authService.initialize();

    const unsubscribe = authService.onAuthStateChanged(async (user) => {
      if (user) {
        const profile = await authService.getUserProfile(user.uid);
        set({
          user,
          userProfile: profile,
          isGuest: user.isAnonymous,
          isLoading: false,
        });
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
      const profile = await authService.getUserProfile(user.uid);
      set({ user, userProfile: profile, isGuest: false, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signUpWithEmail: async (email, password, displayName) => {
    set({ isLoading: true });
    try {
      const user = await authService.signUpWithEmail(email, password, displayName);
      const profile = await authService.getUserProfile(user.uid);
      set({ user, userProfile: profile, isGuest: false, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signInWithEmail: async (email, password) => {
    set({ isLoading: true });
    try {
      const user = await authService.signInWithEmail(email, password);
      const profile = await authService.getUserProfile(user.uid);
      set({ user, userProfile: profile, isGuest: false, isLoading: false });
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
    set({ user: null, userProfile: null, isGuest: false });
  },

  refreshProfile: async () => {
    const { user } = get();
    if (user) {
      const profile = await authService.getUserProfile(user.uid);
      set({ userProfile: profile });
    }
  },
}));
