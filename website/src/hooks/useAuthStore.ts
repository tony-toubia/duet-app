import { create } from 'zustand';
import { User } from 'firebase/auth';
import { ref, get as dbGet, update } from 'firebase/database';
import { authService, UserProfile } from '@/services/AuthService';
import { firebaseDb } from '@/services/firebase';

export interface NotificationPreferences {
  emailOptIn: boolean;
  pushOptIn: boolean;
}

interface AuthState {
  user: User | null;
  userProfile: UserProfile | null;
  preferences: NotificationPreferences;
  isLoading: boolean;
  isGuest: boolean;
  showUpgradeAuth: boolean;
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
  promptUpgrade: () => void;
  cancelUpgrade: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
}

let _authUnsub: (() => void) | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  userProfile: null,
  preferences: { emailOptIn: true, pushOptIn: true },
  isLoading: true,
  isGuest: false,
  showUpgradeAuth: false,
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
          showUpgradeAuth: user.isAnonymous ? get().showUpgradeAuth : false,
        });
        // Ensure profile exists (creates if needed, e.g. for anonymous users)
        await authService.ensureProfile(user);
        const [profile, prefsSnap] = await Promise.all([
          authService.getUserProfile(user.uid),
          dbGet(ref(firebaseDb, `/users/${user.uid}/preferences`)),
        ]);
        if (get().user?.uid === user.uid) {
          const prefsVal = prefsSnap.val() as Record<string, boolean> | null;
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

    return () => {
      if (_authUnsub) {
        _authUnsub();
        _authUnsub = null;
      }
    };
  },

  signInWithGoogle: async () => {
    const user = await authService.signInWithGoogle();
    // Set user + temporary profile from Firebase User object for immediate UI
    set({
      user,
      isGuest: false,
      isLoading: false,
      showUpgradeAuth: false,
      userProfile: {
        displayName: user.displayName || 'Duet User',
        email: user.email || null,
        avatarUrl: user.photoURL || null,
        createdAt: Date.now(),
        authProvider: 'google',
      },
    });
  },

  signUpWithEmail: async (email, password, displayName) => {
    const user = await authService.signUpWithEmail(email, password, displayName);
    set({
      user,
      isGuest: false,
      isLoading: false,
      showUpgradeAuth: false,
      userProfile: {
        displayName: displayName || 'Duet User',
        email: user.email || null,
        avatarUrl: null,
        createdAt: Date.now(),
        authProvider: 'email',
      },
    });
  },

  signInWithEmail: async (email, password) => {
    const user = await authService.signInWithEmail(email, password);
    set({
      user,
      isGuest: false,
      isLoading: false,
      showUpgradeAuth: false,
      userProfile: {
        displayName: user.displayName || 'Duet User',
        email: user.email || null,
        avatarUrl: user.photoURL || null,
        createdAt: Date.now(),
        authProvider: 'email',
      },
    });
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
    const user = await authService.continueAsGuest();
    // Set user immediately so layout switches to lobby without waiting for onAuthStateChanged
    set({ user, isGuest: true, isLoading: false, showUpgradeAuth: false });
  },

  promptUpgrade: () => {
    set({ showUpgradeAuth: true });
  },

  cancelUpgrade: () => {
    set({ showUpgradeAuth: false });
  },

  signOut: async () => {
    // Clear store immediately so UI updates without waiting for onAuthStateChanged
    set({ user: null, userProfile: null, isGuest: false, preferences: { emailOptIn: true, pushOptIn: true } });
    await authService.signOut();
  },

  refreshProfile: async () => {
    const { user } = get();
    if (user) {
      const [profile, prefsSnap] = await Promise.all([
        authService.getUserProfile(user.uid),
        dbGet(ref(firebaseDb, `/users/${user.uid}/preferences`)),
      ]);
      const prefsVal = prefsSnap.val() as Record<string, boolean> | null;
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
    await update(ref(firebaseDb, `/users/${user.uid}/preferences`), prefs);
  },
}));
