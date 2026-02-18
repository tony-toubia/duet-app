import {
  User,
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signInWithCredential,
  linkWithCredential,
  updateProfile,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signOut as firebaseSignOut,
  reload,
} from 'firebase/auth';
import { ref, get, set, update, serverTimestamp } from 'firebase/database';
import { firebaseAuth, firebaseDb } from './firebase';

const EMAIL_LINK_STORAGE_KEY = 'emailForSignIn';

export interface UserProfile {
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: number;
  authProvider: 'google' | 'email' | 'anonymous';
}

class AuthService {
  private googleProvider = new GoogleAuthProvider();

  async signInWithGoogle(): Promise<User> {
    const currentUser = firebaseAuth.currentUser;

    if (currentUser?.isAnonymous) {
      try {
        const result = await signInWithPopup(firebaseAuth, this.googleProvider);
        // Profile creation handled by onAuthStateChanged -> ensureProfile
        // to avoid race where RTDB WebSocket hasn't re-authenticated yet
        return result.user;
      } catch (error: any) {
        if (error.code === 'auth/credential-already-in-use' && error.credential) {
          const result = await signInWithCredential(firebaseAuth, error.credential);
          return result.user;
        }
        throw error;
      }
    }

    const result = await signInWithPopup(firebaseAuth, this.googleProvider);
    // Profile creation handled by onAuthStateChanged -> ensureProfile
    return result.user;
  }

  async signUpWithEmail(email: string, password: string, displayName: string): Promise<User> {
    const currentUser = firebaseAuth.currentUser;

    if (currentUser?.isAnonymous) {
      const emailCredential = EmailAuthProvider.credential(email, password);
      try {
        const result = await linkWithCredential(currentUser, emailCredential);
        await updateProfile(result.user, { displayName });
        await reload(result.user);
        // Profile creation handled by onAuthStateChanged -> ensureProfile
        return result.user;
      } catch (linkError: any) {
        if (linkError.code === 'auth/email-already-in-use') {
          throw new Error('An account with this email already exists. Please sign in instead.');
        }
        throw linkError;
      }
    }

    const result = await createUserWithEmailAndPassword(firebaseAuth, email, password);
    await updateProfile(result.user, { displayName });
    await reload(result.user);
    // Profile creation handled by onAuthStateChanged -> ensureProfile
    return result.user;
  }

  async signInWithEmail(email: string, password: string): Promise<User> {
    const result = await signInWithEmailAndPassword(firebaseAuth, email, password);
    return result.user;
  }

  async continueAsGuest(): Promise<User> {
    const result = await signInAnonymously(firebaseAuth);
    // Profile creation is handled by onAuthStateChanged in useAuthStore
    // to avoid race condition where RTDB connection doesn't have auth token yet
    return result.user;
  }

  private async createOrUpdateProfile(
    user: User,
    provider: 'google' | 'email' | 'anonymous'
  ): Promise<void> {
    const profileRef = ref(firebaseDb, `/users/${user.uid}/profile`);

    let snapshot;
    try {
      snapshot = await get(profileRef);
    } catch (readErr) {
      console.error('Profile read failed:', readErr, 'uid:', user.uid, 'isAnonymous:', user.isAnonymous);
      throw readErr;
    }

    try {
      if (!snapshot.exists()) {
        await set(profileRef, {
          displayName: user.displayName || 'Duet User',
          email: user.email || null,
          avatarUrl: user.photoURL || null,
          createdAt: serverTimestamp(),
          authProvider: provider,
        });
      } else {
        const updates: Record<string, any> = { authProvider: provider };
        if (user.displayName) updates.displayName = user.displayName;
        if (user.email) updates.email = user.email;
        if (user.photoURL && !snapshot.val().avatarUrl) updates.avatarUrl = user.photoURL;
        await update(profileRef, updates);
      }
    } catch (writeErr) {
      console.error('Profile write failed:', writeErr, 'uid:', user.uid, 'exists:', snapshot.exists());
      throw writeErr;
    }
  }

  async sendSignInLink(email: string): Promise<void> {
    const actionCodeSettings = {
      url: `${window.location.origin}/app?emailLink=true`,
      handleCodeInApp: true,
    };

    await sendSignInLinkToEmail(firebaseAuth, email, actionCodeSettings);
    localStorage.setItem(EMAIL_LINK_STORAGE_KEY, email);
  }

  checkSignInWithEmailLink(url: string): boolean {
    return isSignInWithEmailLink(firebaseAuth, url);
  }

  async completeSignInWithEmailLink(url: string, promptedEmail?: string): Promise<User> {
    const email = promptedEmail || localStorage.getItem(EMAIL_LINK_STORAGE_KEY);
    if (!email) {
      throw new Error('EMAIL_REQUIRED');
    }

    const currentUser = firebaseAuth.currentUser;

    if (currentUser?.isAnonymous) {
      try {
        const emailCredential = EmailAuthProvider.credentialWithLink(email, url);
        const result = await linkWithCredential(currentUser, emailCredential);
        await updateProfile(result.user, { displayName: email.split('@')[0] });
        // Profile creation handled by onAuthStateChanged -> ensureProfile
        localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
        return result.user;
      } catch (linkError: any) {
        if (linkError.code === 'auth/credential-already-in-use') {
          const result = await signInWithEmailLink(firebaseAuth, email, url);
          localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
          return result.user;
        }
        throw linkError;
      }
    }

    const result = await signInWithEmailLink(firebaseAuth, email, url);
    // Profile creation handled by onAuthStateChanged -> ensureProfile
    localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
    return result.user;
  }

  getPendingSignInEmail(): string | null {
    return localStorage.getItem(EMAIL_LINK_STORAGE_KEY);
  }

  clearPendingSignInEmail(): void {
    localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
  }

  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return firebaseOnAuthStateChanged(firebaseAuth, callback);
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(firebaseAuth);
  }

  getCurrentUser(): User | null {
    return firebaseAuth.currentUser;
  }

  isAnonymous(): boolean {
    return firebaseAuth.currentUser?.isAnonymous ?? true;
  }

  async ensureProfile(user: User): Promise<void> {
    const provider = user.isAnonymous
      ? 'anonymous'
      : user.providerData[0]?.providerId === 'google.com'
        ? 'google'
        : 'email';

    // Retry with backoff — RTDB WebSocket may not have the new auth token yet
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.createOrUpdateProfile(user, provider as 'google' | 'email' | 'anonymous');
        return;
      } catch (err) {
        if (attempt < 2) {
          console.warn(`[Auth] Profile write attempt ${attempt + 1} failed, retrying...`);
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        } else {
          console.error('[Auth] Profile write failed after retries:', err);
        }
      }
    }
  }

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const snapshot = await get(ref(firebaseDb, `/users/${uid}/profile`));
    return snapshot.val();
  }
}

export const authService = new AuthService();
