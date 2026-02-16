import { ref, get, push, set, serverTimestamp } from 'firebase/database';
import { firebaseAuth, firebaseDb } from './firebase';

class InvitationService {
  async sendInvitation(toUid: string, roomCode: string): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error('Must be signed in.');

    const profileSnap = await get(ref(firebaseDb, `/users/${user.uid}/profile`));
    const profile = profileSnap.val();

    const invitationRef = push(ref(firebaseDb, '/invitations'));
    await set(invitationRef, {
      fromUid: user.uid,
      fromDisplayName: profile?.displayName || user.displayName || 'Someone',
      toUid,
      roomCode,
      createdAt: serverTimestamp(),
      status: 'pending',
    });
  }

  async sendBulkInvitations(friendUids: string[], roomCode: string): Promise<void> {
    const promises = friendUids.map((uid) => this.sendInvitation(uid, roomCode));
    await Promise.all(promises);
  }
}

export const invitationService = new InvitationService();
