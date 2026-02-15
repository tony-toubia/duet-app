import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';

class PresenceService {
  private isSetUp = false;

  /**
   * Set up presence tracking for the current user.
   * Uses Firebase's `.info/connected` to detect online/offline state.
   */
  setup(): () => void {
    const user = auth().currentUser;
    if (!user || this.isSetUp) return () => {};

    this.isSetUp = true;
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
      statusRef.set({
        state: 'offline',
        lastSeen: database.ServerValue.TIMESTAMP,
      });
      this.isSetUp = false;
    };
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
