import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';

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
  /**
   * Send a friend request to another user
   */
  async sendFriendRequest(targetUid: string): Promise<void> {
    const user = auth().currentUser;
    if (!user) throw new Error('Must be signed in.');

    // Get current user's profile
    const myProfile = await database().ref(`/users/${user.uid}/profile`).once('value');
    const myData = myProfile.val() || {};

    // Get target user's profile
    const targetProfile = await database().ref(`/users/${targetUid}/profile`).once('value');
    const targetData = targetProfile.val();
    if (!targetData) throw new Error('User not found.');

    // Write to both users' friend lists atomically
    const updates: Record<string, any> = {};
    updates[`/friends/${user.uid}/${targetUid}`] = {
      status: 'pending',
      displayName: targetData.displayName || 'Duet User',
      avatarUrl: targetData.avatarUrl || null,
      addedAt: database.ServerValue.TIMESTAMP,
      initiatedBy: user.uid,
    };
    updates[`/friends/${targetUid}/${user.uid}`] = {
      status: 'pending',
      displayName: myData.displayName || 'Duet User',
      avatarUrl: myData.avatarUrl || null,
      addedAt: database.ServerValue.TIMESTAMP,
      initiatedBy: user.uid,
    };

    await database().ref().update(updates);
    console.log('[Friends] Request sent to:', targetUid);
  }

  /**
   * Accept a friend request
   */
  async acceptFriendRequest(friendUid: string): Promise<void> {
    const user = auth().currentUser;
    if (!user) throw new Error('Must be signed in.');

    const updates: Record<string, any> = {};
    updates[`/friends/${user.uid}/${friendUid}/status`] = 'accepted';
    updates[`/friends/${friendUid}/${user.uid}/status`] = 'accepted';

    await database().ref().update(updates);
    console.log('[Friends] Accepted request from:', friendUid);
  }

  /**
   * Decline/remove a friend
   */
  async removeFriend(friendUid: string): Promise<void> {
    const user = auth().currentUser;
    if (!user) throw new Error('Must be signed in.');

    const updates: Record<string, any> = {};
    updates[`/friends/${user.uid}/${friendUid}`] = null;
    updates[`/friends/${friendUid}/${user.uid}`] = null;

    await database().ref().update(updates);
    console.log('[Friends] Removed friend:', friendUid);
  }

  /**
   * Subscribe to friends list changes
   */
  subscribeFriends(callback: (friends: Record<string, FriendEntry>) => void): () => void {
    const user = auth().currentUser;
    if (!user) return () => {};

    const ref = database().ref(`/friends/${user.uid}`);
    const handler = ref.on('value', (snapshot) => {
      callback(snapshot.val() || {});
    });

    return () => ref.off('value', handler);
  }

  /**
   * Record a recent connection (when you connect with someone in a room)
   */
  async recordRecentConnection(
    partnerUid: string,
    partnerDisplayName: string,
    partnerAvatarUrl: string | null,
    roomCode: string
  ): Promise<void> {
    const user = auth().currentUser;
    if (!user) return;

    await database().ref(`/recentConnections/${user.uid}/${partnerUid}`).set({
      displayName: partnerDisplayName,
      avatarUrl: partnerAvatarUrl,
      lastConnectedAt: database.ServerValue.TIMESTAMP,
      roomCode,
    });
  }

  /**
   * Subscribe to recent connections
   */
  subscribeRecentConnections(callback: (connections: Record<string, RecentConnection>) => void): () => void {
    const user = auth().currentUser;
    if (!user) return () => {};

    const ref = database().ref(`/recentConnections/${user.uid}`).orderByChild('lastConnectedAt').limitToLast(20);
    const handler = ref.on('value', (snapshot) => {
      callback(snapshot.val() || {});
    });

    return () => ref.off('value', handler);
  }

  /**
   * Search users by display name (uses Cloud Function in production)
   * For now, this is a simple client-side query
   */
  async searchUsers(query: string): Promise<Array<{ uid: string; displayName: string; avatarUrl: string | null }>> {
    if (query.length < 2) return [];

    const user = auth().currentUser;
    if (!user) return [];

    // Query users whose displayName starts with the search term
    const snapshot = await database()
      .ref('/users')
      .orderByChild('profile/displayName')
      .startAt(query)
      .endAt(query + '\uf8ff')
      .limitToFirst(10)
      .once('value');

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
      return undefined;
    });

    return results;
  }
}

export const friendsService = new FriendsService();
