import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';
import { Share } from 'react-native';
import { friendsService } from './FriendsService';

class ReferralService {
  /**
   * Returns the current user's friend code (used as their referral code).
   * Creates one if it doesn't exist yet.
   */
  async getReferralCode(): Promise<string | null> {
    const user = auth().currentUser;
    if (!user) return null;

    const snap = await database()
      .ref(`/users/${user.uid}/profile/friendCode`)
      .once('value');
    return snap.val() || null;
  }

  /**
   * Returns the number of successful referrals for the current user.
   */
  async getReferralCount(): Promise<number> {
    const user = auth().currentUser;
    if (!user) return 0;

    const snap = await database()
      .ref(`/referrals/${user.uid}`)
      .once('value');
    return snap.numChildren();
  }

  /**
   * Records a referral under the current user's referrals node.
   */
  async recordReferral(referredUid: string, referredName: string): Promise<void> {
    const user = auth().currentUser;
    if (!user) throw new Error('Must be signed in.');

    await database()
      .ref(`/referrals/${user.uid}`)
      .push({
        referredUid,
        referredAt: database.ServerValue.TIMESTAMP,
        referredName,
      });

    console.log('[Referral] Recorded referral for:', referredUid);
  }

  /**
   * Opens the native share sheet with the user's referral code.
   */
  async shareReferralLink(): Promise<void> {
    const user = auth().currentUser;
    if (!user) throw new Error('Must be signed in.');

    const code = await friendsService.getOrCreateFriendCode();

    await Share.share({
      message: `Join me on Duet! Use my referral code ${code} when you sign up. Let's connect!`,
    });
  }
}

export const referralService = new ReferralService();
