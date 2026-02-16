import {
  ref,
  get,
  set,
  update,
  onValue,
  query,
  orderByChild,
  startAt,
  endAt,
  limitToFirst,
  limitToLast,
  serverTimestamp,
} from 'firebase/database';
import { firebaseAuth, firebaseDb } from './firebase';

export interface FriendEntry {
  status: 'pending' | 'accepted';
  displayName: string;
  avatarUrl: string | null;
  addedAt: number;
  initiatedBy: string;
}

export interface RecentConnection {
  displayName: string;
  avatarUrl: string | null;
  lastConnectedAt: number;
  roomCode: string;
}

class FriendsService {
  async sendFriendRequest(targetUid: string): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error('Must be signed in.');

    const mySnap = await get(ref(firebaseDb, `/users/${user.uid}/profile`));
    const myData = mySnap.val() || {};

    const targetSnap = await get(ref(firebaseDb, `/users/${targetUid}/profile`));
    const targetData = targetSnap.val();
    if (!targetData) throw new Error('User not found.');

    const updates: Record<string, any> = {};
    updates[`/friends/${user.uid}/${targetUid}`] = {
      status: 'pending',
      displayName: targetData.displayName || 'Duet User',
      avatarUrl: targetData.avatarUrl || null,
      addedAt: serverTimestamp(),
      initiatedBy: user.uid,
    };
    updates[`/friends/${targetUid}/${user.uid}`] = {
      status: 'pending',
      displayName: myData.displayName || 'Duet User',
      avatarUrl: myData.avatarUrl || null,
      addedAt: serverTimestamp(),
      initiatedBy: user.uid,
    };

    await update(ref(firebaseDb), updates);
  }

  async acceptFriendRequest(friendUid: string): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error('Must be signed in.');

    const updates: Record<string, any> = {};
    updates[`/friends/${user.uid}/${friendUid}/status`] = 'accepted';
    updates[`/friends/${friendUid}/${user.uid}/status`] = 'accepted';

    await update(ref(firebaseDb), updates);
  }

  async removeFriend(friendUid: string): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error('Must be signed in.');

    const updates: Record<string, any> = {};
    updates[`/friends/${user.uid}/${friendUid}`] = null;
    updates[`/friends/${friendUid}/${user.uid}`] = null;

    await update(ref(firebaseDb), updates);
  }

  subscribeFriends(callback: (friends: Record<string, FriendEntry>) => void): () => void {
    const user = firebaseAuth.currentUser;
    if (!user) return () => {};

    const friendsRef = ref(firebaseDb, `/friends/${user.uid}`);
    const unsub = onValue(friendsRef, (snapshot) => {
      callback(snapshot.val() || {});
    });
    return unsub;
  }

  async recordRecentConnection(
    partnerUid: string,
    partnerDisplayName: string,
    partnerAvatarUrl: string | null,
    roomCode: string
  ): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user) return;

    await set(ref(firebaseDb, `/recentConnections/${user.uid}/${partnerUid}`), {
      displayName: partnerDisplayName,
      avatarUrl: partnerAvatarUrl,
      lastConnectedAt: serverTimestamp(),
      roomCode,
    });
  }

  subscribeRecentConnections(
    callback: (connections: Record<string, RecentConnection>) => void
  ): () => void {
    const user = firebaseAuth.currentUser;
    if (!user) return () => {};

    const q = query(
      ref(firebaseDb, `/recentConnections/${user.uid}`),
      orderByChild('lastConnectedAt'),
      limitToLast(20)
    );
    const unsub = onValue(q, (snapshot) => {
      callback(snapshot.val() || {});
    });
    return unsub;
  }

  async searchUsers(
    searchQuery: string
  ): Promise<Array<{ uid: string; displayName: string; avatarUrl: string | null }>> {
    if (searchQuery.length < 2) return [];

    const user = firebaseAuth.currentUser;
    if (!user) return [];

    const q = query(
      ref(firebaseDb, '/users'),
      orderByChild('profile/displayName'),
      startAt(searchQuery),
      endAt(searchQuery + '\uf8ff'),
      limitToFirst(10)
    );

    const snapshot = await get(q);
    const results: Array<{ uid: string; displayName: string; avatarUrl: string | null }> = [];

    snapshot.forEach((child) => {
      const uid = child.key;
      if (uid && uid !== user.uid) {
        const profile = child.val()?.profile;
        if (profile) {
          results.push({
            uid,
            displayName: profile.displayName || 'Duet User',
            avatarUrl: profile.avatarUrl || null,
          });
        }
      }
    });

    return results;
  }
}

export const friendsService = new FriendsService();
