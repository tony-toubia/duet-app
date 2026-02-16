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

  setup(): () => void {
    const user = firebaseAuth.currentUser;
    if (!user || this.isSetUp) return () => {};

    this.isSetUp = true;
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
      set(statusRef, {
        state: 'offline',
        lastSeen: serverTimestamp(),
      });
      this.isSetUp = false;
    };
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
