import {
  ref,
  onValue,
  set,
  onDisconnect,
  serverTimestamp,
} from 'firebase/database';
import { firebaseAuth, firebaseDb } from './firebase';

class PresenceService {
  private isSetUp = false;
  // Set while an account is being deleted so teardown doesn't re-create
  // the user's status entry after the server has removed it
  private suppressOfflineWrite = false;

  setup(): () => void {
    const user = firebaseAuth.currentUser;
    if (!user || this.isSetUp) return () => {};

    this.isSetUp = true;
    this.suppressOfflineWrite = false;
    const statusRef = ref(firebaseDb, `/status/${user.uid}`);
    const connectedRef = ref(firebaseDb, '.info/connected');

    const unsubscribe = onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === true) {
        onDisconnect(statusRef).set({
          state: 'offline',
          lastSeen: serverTimestamp(),
        });
        set(statusRef, {
          state: 'online',
          lastSeen: serverTimestamp(),
        });
      }
    });

    return () => {
      unsubscribe();
      if (!this.suppressOfflineWrite) {
        set(statusRef, {
          state: 'offline',
          lastSeen: serverTimestamp(),
        });
      }
      this.isSetUp = false;
    };
  }

  /**
   * Before deleting the account: cancel the server-side onDisconnect write
   * and skip the "offline" write on teardown, so nothing re-creates this
   * user's status entry once their data is gone.
   */
  async teardownForDeletion(): Promise<void> {
    this.suppressOfflineWrite = true;
    const user = firebaseAuth.currentUser;
    if (!user) return;
    await onDisconnect(ref(firebaseDb, `/status/${user.uid}`)).cancel().catch(() => {});
  }

  /** Deletion failed and the user is still signed in: restore presence. */
  cancelDeletionTeardown(): void {
    this.suppressOfflineWrite = false;
    const user = firebaseAuth.currentUser;
    if (!user || !this.isSetUp) return;
    onDisconnect(ref(firebaseDb, `/status/${user.uid}`)).set({
      state: 'offline',
      lastSeen: serverTimestamp(),
    });
  }

  subscribeToStatus(
    uid: string,
    callback: (status: { state: 'online' | 'offline'; lastSeen: number }) => void
  ): () => void {
    const statusRef = ref(firebaseDb, `/status/${uid}`);
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const val = snapshot.val();
      callback(val || { state: 'offline', lastSeen: 0 });
    });
    return unsubscribe;
  }

  subscribeToStatuses(
    uids: string[],
    callback: (statuses: Record<string, { state: 'online' | 'offline'; lastSeen: number }>) => void
  ): () => void {
    const statuses: Record<string, { state: 'online' | 'offline'; lastSeen: number }> = {};
    const unsubs: (() => void)[] = [];

    for (const uid of uids) {
      const unsub = this.subscribeToStatus(uid, (status) => {
        statuses[uid] = status;
        callback({ ...statuses });
      });
      unsubs.push(unsub);
    }

    return () => unsubs.forEach((u) => u());
  }
}

export const presenceService = new PresenceService();
