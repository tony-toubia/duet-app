import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';
import { analyticsService } from './AnalyticsService';

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
    const user = auth().currentUser;
    if (!user) throw new Error('Must be signed in.');

    const myProfile = await database().ref(`/users/${user.uid}/profile`).once('value');
    const myData = myProfile.val() || {};

    const targetProfile = await database().ref(`/users/${targetUid}/profile`).once('value');
    const targetData = targetProfile.val();
    if (!targetData) throw new Error('User not found.');

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
    analyticsService.logFriendAdded();
    console.log('[Friends] Request sent to:', targetUid);
  }

  async acceptFriendRequest(friendUid: string): Promise<void> {
    const user = auth().currentUser;
    if (!user) throw new Error('Must be signed in.');

    const updates: Record<string, any> = {};
    updates[`/friends/${user.uid}/${friendUid}/status`] = 'accepted';
    updates[`/friends/${friendUid}/${user.uid}/status`] = 'accepted';

    await database().ref().update(updates);
    console.log('[Friends] Accepted request from:', friendUid);
  }

  async removeFriend(friendUid: string): Promise<void> {
    const user = auth().currentUser;
    if (!user) throw new Error('Must be signed in.');

    const updates: Record<string, any> = {};
    updates[`/friends/${user.uid}/${friendUid}`] = null;
    updates[`/friends/${friendUid}/${user.uid}`] = null;

    await database().ref().update(updates);
    console.log('[Friends] Removed friend:', friendUid);
  }

  subscribeFriends(callback: (friends: Record<string, FriendEntry>) => void): () => void {
    const user = auth().currentUser;
    if (!user) return () => {};

    const dbRef = database().ref(`/friends/${user.uid}`);
    const handler = dbRef.on('value', (snapshot) => {
      callback(snapshot.val() || {});
    });

    return () => dbRef.off('value', handler);
  }

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

  subscribeRecentConnections(callback: (connections: Record<string, RecentConnection>) => void): () => void {
    const user = auth().currentUser;
    if (!user) return () => {};

    const dbRef = database().ref(`/recentConnections/${user.uid}`).orderByChild('lastConnectedAt').limitToLast(20);
    const handler = dbRef.on('value', (snapshot) => {
      callback(snapshot.val() || {});
    });

    return () => dbRef.off('value', handler);
  }

  async searchByEmail(
    email: string
  ): Promise<{ uid: string; displayName: string; avatarUrl: string | null } | null> {
    const trimmed = email.toLowerCase().trim();
    if (!trimmed) return null;

    const user = auth().currentUser;
    if (!user) return null;

    const snapshot = await database()
      .ref('/users')
      .orderByChild('profile/email')
      .equalTo(trimmed)
      .limitToFirst(1)
      .once('value');

    let result: { uid: string; displayName: string; avatarUrl: string | null } | null = null;

    snapshot.forEach((child) => {
      const uid = child.key;
      if (uid && uid !== user.uid) {
        const profile = child.val()?.profile;
        if (profile) {
          result = {
            uid,
            displayName: profile.displayName || 'Duet User',
            avatarUrl: profile.avatarUrl || null,
          };
        }
      }
      return undefined;
    });

    return result;
  }

  async getFriendCode(): Promise<string | null> {
    const user = auth().currentUser;
    if (!user) return null;

    const snap = await database().ref(`/users/${user.uid}/profile/friendCode`).once('value');
    return snap.val() || null;
  }

  async generateFriendCode(): Promise<string> {
    const user = auth().currentUser;
    if (!user) throw new Error('Must be signed in.');

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    let attempts = 0;

    do {
      code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const existing = await database().ref(`/friendCodes/${code}`).once('value');
      if (!existing.exists()) break;
      attempts++;
    } while (attempts < 10);

    const updates: Record<string, any> = {};
    updates[`/users/${user.uid}/profile/friendCode`] = code;
    updates[`/friendCodes/${code}`] = user.uid;
    await database().ref().update(updates);

    return code;
  }

  async getOrCreateFriendCode(): Promise<string> {
    const existing = await this.getFriendCode();
    if (existing) return existing;
    return this.generateFriendCode();
  }

  async lookupFriendCode(
    code: string
  ): Promise<{ uid: string; displayName: string; avatarUrl: string | null } | null> {
    const trimmed = code.toUpperCase().trim();
    if (trimmed.length !== 8) return null;

    const user = auth().currentUser;
    if (!user) return null;

    const snap = await database().ref(`/friendCodes/${trimmed}`).once('value');
    const uid = snap.val();
    if (!uid || uid === user.uid) return null;

    const profileSnap = await database().ref(`/users/${uid}/profile`).once('value');
    const profile = profileSnap.val();
    if (!profile) return null;

    return {
      uid,
      displayName: profile.displayName || 'Duet User',
      avatarUrl: profile.avatarUrl || null,
    };
  }
}

export const friendsService = new FriendsService();
