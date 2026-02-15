import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';

class InvitationService {
  /**
   * Send a room invitation to a friend
   */
  async sendInvitation(toUid: string, roomCode: string): Promise<void> {
    const user = auth().currentUser;
    if (!user) throw new Error('Must be signed in.');

    // Get current user's profile for the display name
    const profileSnap = await database().ref(`/users/${user.uid}/profile`).once('value');
    const profile = profileSnap.val();

    const invitationRef = database().ref('/invitations').push();
    await invitationRef.set({
      fromUid: user.uid,
      fromDisplayName: profile?.displayName || user.displayName || 'Someone',
      toUid,
      roomCode,
      createdAt: database.ServerValue.TIMESTAMP,
      status: 'pending',
    });

    console.log('[Invitation] Sent invitation to:', toUid, 'for room:', roomCode);
  }

  /**
   * Send invitations to multiple friends
   */
  async sendBulkInvitations(friendUids: string[], roomCode: string): Promise<void> {
    const promises = friendUids.map((uid) => this.sendInvitation(uid, roomCode));
    await Promise.all(promises);
  }
}

export const invitationService = new InvitationService();
