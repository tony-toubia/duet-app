import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';
import { analyticsService } from './AnalyticsService';
import { callFunction } from './CloudFunctions';

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

export interface PublicProfile {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
}

/**
 * Read another user's public profile fields. Rules only expose displayName
 * and avatarUrl to other users (email and the rest of the profile are
 * owner-only), so read the two fields rather than the whole profile.
 */
export async function getPublicProfile(uid: string): Promise<PublicProfile | null> {
  const base = `/users/${uid}/profile`;
  const [nameSnap, avatarSnap] = await Promise.all([
    database().ref(`${base}/displayName`).once('value'),
    database().ref(`${base}/avatarUrl`).once('value'),
  ]);
  if (!nameSnap.exists()) return null;
  return { uid, displayName: nameSnap.val() || 'Duet User', avatarUrl: avatarSnap.val() || null };
}

class FriendsService {
  async sendFriendRequest(targetUid: string): Promise<void> {
    const user = auth().currentUser;
    if (!user) throw new Error('Must be signed in.');

    const myProfile = await database().ref(`/users/${user.uid}/profile`).once('value');
    const myData = myProfile.val() || {};

    const targetData = await getPublicProfile(targetUid);
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

    // Server-side lookup: returns only uid, display name and photo
    const { user: found } = await callFunction<{ user: PublicProfile | null }>('searchUserByEmail', {
      email: trimmed,
    });
    return found && found.uid !== user.uid ? found : null;
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

    return getPublicProfile(uid);
  }
}

export const friendsService = new FriendsService();
