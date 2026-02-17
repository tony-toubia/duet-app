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
        // Can't link with popup directly, so sign in then the anonymous data is lost
        // This is a known limitation — popup doesn't return a credential we can link with
        const result = await signInWithPopup(firebaseAuth, this.googleProvider);
        await this.createOrUpdateProfile(result.user, 'google');
        return result.user;
      } catch (error: any) {
        if (error.code === 'auth/credential-already-in-use' && error.credential) {
          const result = await signInWithCredential(firebaseAuth, error.credential);
          await this.createOrUpdateProfile(result.user, 'google');
          return result.user;
        }
        throw error;
      }
    }

    const result = await signInWithPopup(firebaseAuth, this.googleProvider);
    await this.createOrUpdateProfile(result.user, 'google');
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
        await this.createOrUpdateProfile(result.user, 'email');
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
    await this.createOrUpdateProfile(result.user, 'email');
    return result.user;
  }

  async signInWithEmail(email: string, password: string): Promise<User> {
    const result = await signInWithEmailAndPassword(firebaseAuth, email, password);
    return result.user;
  }

  async continueAsGuest(): Promise<User> {
    const result = await signInAnonymously(firebaseAuth);
    await this.createOrUpdateProfile(result.user, 'anonymous');
    return result.user;
  }

  private async createOrUpdateProfile(
    user: User,
    provider: 'google' | 'email' | 'anonymous'
  ): Promise<void> {
    const profileRef = ref(firebaseDb, `/users/${user.uid}/profile`);
    const snapshot = await get(profileRef);

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
        await this.createOrUpdateProfile(result.user, 'email');
        localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
        return result.user;
      } catch (linkError: any) {
        if (linkError.code === 'auth/credential-already-in-use') {
          const result = await signInWithEmailLink(firebaseAuth, email, url);
          await this.createOrUpdateProfile(result.user, 'email');
          localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
          return result.user;
        }
        throw linkError;
      }
    }

    const result = await signInWithEmailLink(firebaseAuth, email, url);
    await this.createOrUpdateProfile(result.user, 'email');
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

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const snapshot = await get(ref(firebaseDb, `/users/${uid}/profile`));
    return snapshot.val();
  }
}

export const authService = new AuthService();
