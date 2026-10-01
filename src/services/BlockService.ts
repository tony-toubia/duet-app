import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';

export interface BlockedUser {
  uid: string;
  displayName: string;
  blockedAt: number;
}

/**
 * The signed-in user's block list (/blocks/{uid}), kept in memory so rooms
 * can check it synchronously. Database rules also enforce blocks: a blocked
 * person can't send you friend requests or invitations, or join rooms you
 * created.
 */
class BlockService {
  private blocked: Record<string, { displayName?: string; blockedAt?: number }> = {};
  private listeners = new Set<() => void>();

  /** Subscribe to the current user's block list. Returns an unsubscribe. */
  start(): () => void {
    const user = auth().currentUser;
    if (!user) return () => {};
    const ref = database().ref(`/blocks/${user.uid}`);
    const handler = ref.on('value', (snap) => {
      this.blocked = snap.val() || {};
      this.listeners.forEach((l) => l());
    });
    return () => {
      ref.off('value', handler);
      this.blocked = {};
      this.listeners.forEach((l) => l());
    };
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  isBlocked(uid: string | null | undefined): boolean {
    return !!uid && !!this.blocked[uid];
  }

  list(): BlockedUser[] {
    return Object.entries(this.blocked)
      .map(([uid, b]) => ({ uid, displayName: b.displayName || 'Duet User', blockedAt: b.blockedAt || 0 }))
      .sort((a, b) => b.blockedAt - a.blockedAt);
  }

  /**
   * Block someone: also removes the friendship on both sides, your recent
   * connection to them, and your quick-reconnect shortcut if it points at them.
   */
  async block(uid: string, displayName: string): Promise<void> {
    const me = auth().currentUser;
    if (!me) throw new Error('Must be signed in.');
    if (uid === me.uid) return;

    const updates: Record<string, any> = {
      [`/blocks/${me.uid}/${uid}`]: {
        blockedAt: database.ServerValue.TIMESTAMP,
        displayName: (displayName || 'Duet User').slice(0, 99),
      },
      [`/friends/${me.uid}/${uid}`]: null,
      [`/friends/${uid}/${me.uid}`]: null,
      [`/recentConnections/${me.uid}/${uid}`]: null,
    };
    const shortcut = await database().ref(`/users/${me.uid}/persistentRoom/partnerUid`).once('value');
    if (shortcut.val() === uid) updates[`/users/${me.uid}/persistentRoom`] = null;
    await database().ref().update(updates);
  }

  async unblock(uid: string): Promise<void> {
    const me = auth().currentUser;
    if (!me) throw new Error('Must be signed in.');
    await database().ref(`/blocks/${me.uid}/${uid}`).remove();
  }
}

export const blockService = new BlockService();
