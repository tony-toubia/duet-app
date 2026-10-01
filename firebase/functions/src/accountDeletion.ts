/**
 * Account deletion: removes everything Duet stores about a user, then the
 * Firebase Auth account itself. Used by the in-app "Delete account" option
 * (deleteAccount callable), for guests and signed-in users alike.
 *
 * Idempotent: running it twice (e.g. after a timeout) finishes the job.
 */
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';

export interface DeletionSummary {
  pathsRemoved: number;
  avatarRemoved: boolean;
  authUserRemoved: boolean;
}

/**
 * Collect every RTDB path to clear for a user. Exported for tests.
 * Covers the user's own nodes plus copies held under other users' nodes
 * that we can locate from the user's own data (friend entries, recent
 * connections, quick-reconnect shortcuts) and indexed collections
 * (invitations, marketing send log).
 */
export async function collectUserPaths(uid: string): Promise<string[]> {
  const db = getDatabase();
  const paths = new Set<string>([
    `users/${uid}`,
    `friends/${uid}`,
    `recentConnections/${uid}`,
    `status/${uid}`,
    `events/${uid}`,
    `referrals/${uid}`,
    `blocks/${uid}`,
    `emailState/${uid}`,
    `rateLimits/${uid}`,
    `marketing/journeyState/${uid}`,
  ]);

  const [profile, friends, recents, invitesFrom, invitesTo, sendLog] = await Promise.all([
    db.ref(`users/${uid}/profile`).once('value'),
    db.ref(`friends/${uid}`).once('value'),
    db.ref(`recentConnections/${uid}`).once('value'),
    db.ref('invitations').orderByChild('fromUid').equalTo(uid).once('value'),
    db.ref('invitations').orderByChild('toUid').equalTo(uid).once('value'),
    db.ref('marketing/sendLog').orderByChild('userId').equalTo(uid).once('value'),
  ]);

  const friendCode = profile.val()?.friendCode;
  if (typeof friendCode === 'string' && friendCode) {
    const owner = (await db.ref(`friendCodes/${friendCode}`).once('value')).val();
    if (owner === uid) paths.add(`friendCodes/${friendCode}`);
  }

  // People this user knows hold copies of their name/photo
  const contacts = new Set<string>([
    ...Object.keys(friends.val() || {}),
    ...Object.keys(recents.val() || {}),
  ]);
  contacts.delete(uid);
  for (const other of contacts) {
    paths.add(`friends/${other}/${uid}`);
    paths.add(`recentConnections/${other}/${uid}`);
  }
  const shortcuts = await Promise.all(
    [...contacts].map(async (other) => ({
      other,
      partnerUid: (await db.ref(`users/${other}/persistentRoom/partnerUid`).once('value')).val(),
    }))
  );
  for (const { other, partnerUid } of shortcuts) {
    if (partnerUid === uid) paths.add(`users/${other}/persistentRoom`);
  }

  for (const snap of [invitesFrom, invitesTo]) {
    for (const id of Object.keys(snap.val() || {})) paths.add(`invitations/${id}`);
  }
  for (const id of Object.keys(sendLog.val() || {})) paths.add(`marketing/sendLog/${id}`);

  return [...paths];
}

export async function deleteUserAccount(uid: string): Promise<DeletionSummary> {
  const db = getDatabase();
  const paths = await collectUserPaths(uid);

  // One multi-path update: all-or-nothing for the database part
  const updates: Record<string, null> = {};
  for (const p of paths) updates[p] = null;
  await db.ref().update(updates);

  let avatarRemoved = false;
  try {
    await getStorage().bucket().file(`avatars/${uid}.jpg`).delete({ ignoreNotFound: true });
    avatarRemoved = true;
  } catch (error) {
    logger.error('[DeleteAccount] Avatar delete failed', { uid, error: String(error) });
  }

  let authUserRemoved = false;
  try {
    await getAuth().deleteUser(uid);
    authUserRemoved = true;
  } catch (error: any) {
    if (error?.code === 'auth/user-not-found') authUserRemoved = true;
    else throw error;
  }

  // The client's presence onDisconnect can race the delete and re-create
  // its status entry; clear it once more now that the account is gone.
  await db.ref(`status/${uid}`).remove();

  logger.info('[DeleteAccount] Account deleted', { uid, paths: paths.length, avatarRemoved });
  return { pathsRemoved: paths.length, avatarRemoved, authUserRemoved };
}
