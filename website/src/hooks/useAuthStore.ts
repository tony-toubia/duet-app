import { create } from 'zustand';
import { User } from 'firebase/auth';
import { authService, UserProfile } from '@/services/AuthService';

interface AuthState {
  user: User | null;
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

let _authUnsub: (() => void) | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  userProfile: null,
  isLoading: true,
  isGuest: false,
  emailLinkSent: false,
  emailLinkEmail: null,

  initializeAuth: () => {
    // Prevent duplicate listeners (React strict mode double-mounts)
    if (_authUnsub) {
      _authUnsub();
      _authUnsub = null;
    }

    _authUnsub = authService.onAuthStateChanged(async (user) => {
      if (user) {
        set({
          user,
          isGuest: user.isAnonymous,
          isLoading: false,
        });
        const profile = await authService.getUserProfile(user.uid);
        if (get().user?.uid === user.uid) {
          set({ userProfile: profile });
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

    return () => {
      if (_authUnsub) {
        _authUnsub();
        _authUnsub = null;
      }
    };
  },

  signInWithGoogle: async () => {
    await authService.signInWithGoogle();
    // onAuthStateChanged will update the store
  },

  signUpWithEmail: async (email, password, displayName) => {
    await authService.signUpWithEmail(email, password, displayName);
  },

  signInWithEmail: async (email, password) => {
    await authService.signInWithEmail(email, password);
  },

  sendSignInLink: async (email) => {
    await authService.sendSignInLink(email);
    set({ emailLinkSent: true, emailLinkEmail: email });
  },

  completeSignInWithEmailLink: async (url, email) => {
    await authService.completeSignInWithEmailLink(url, email);
    set({ emailLinkSent: false, emailLinkEmail: null });
  },

  continueAsGuest: async () => {
    await authService.continueAsGuest();
    // onAuthStateChanged will update the store
  },

  signOut: async () => {
    await authService.signOut();
    // onAuthStateChanged will set user to null
  },

  refreshProfile: async () => {
    const { user } = get();
    if (user) {
      const profile = await authService.getUserProfile(user.uid);
      set({ userProfile: profile });
    }
  },
}));
