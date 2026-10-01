import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';

class PresenceService {
  private isSetUp = false;
  // Set while an account is being deleted so teardown doesn't re-create
  // the user's status entry after the server has removed it
  private suppressOfflineWrite = false;

  /**
   * Set up presence tracking for the current user.
   * Uses Firebase's `.info/connected` to detect online/offline state.
   */
  setup(): () => void {
    const user = auth().currentUser;
    if (!user || this.isSetUp) return () => {};

    this.isSetUp = true;
    this.suppressOfflineWrite = false;
    const statusRef = database().ref(`/status/${user.uid}`);
    const connectedRef = database().ref('.info/connected');

    const handler = connectedRef.on('value', (snapshot) => {
      if (snapshot.val() === true) {
        // We're connected — set online and register onDisconnect
        statusRef.onDisconnect().set({
          state: 'offline',
          lastSeen: database.ServerValue.TIMESTAMP,
        });
        statusRef.set({
          state: 'online',
          lastSeen: database.ServerValue.TIMESTAMP,
        });
      }
    });

    return () => {
      connectedRef.off('value', handler);
      if (!this.suppressOfflineWrite) {
        statusRef.set({
          state: 'offline',
          lastSeen: database.ServerValue.TIMESTAMP,
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
    const user = auth().currentUser;
    if (!user) return;
    await database().ref(`/status/${user.uid}`).onDisconnect().cancel().catch(() => {});
  }

  /** Deletion failed and the user is still signed in: restore presence. */
  cancelDeletionTeardown(): void {
    this.suppressOfflineWrite = false;
    const user = auth().currentUser;
    if (!user || !this.isSetUp) return;
    database().ref(`/status/${user.uid}`).onDisconnect().set({
      state: 'offline',
      lastSeen: database.ServerValue.TIMESTAMP,
    });
  }

  /**
   * Subscribe to a user's presence status
   */
  subscribeToStatus(
    uid: string,
    callback: (status: { state: 'online' | 'offline'; lastSeen: number }) => void
  ): () => void {
    const ref = database().ref(`/status/${uid}`);
    const handler = ref.on('value', (snapshot) => {
      const val = snapshot.val();
      callback(val || { state: 'offline', lastSeen: 0 });
    });

    return () => ref.off('value', handler);
  }

  /**
   * Subscribe to multiple users' statuses at once
   */
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
