/**
 * User-facing callable functions. Each one requires a signed-in caller
 * (guests included, since guests are anonymous Firebase users) and returns
 * only what the caller is allowed to see.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { checkRateLimit } from './rateLimit';

export interface PublicProfile {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
}

// Loose but sufficient: rejects obvious junk before it costs an Auth lookup.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Email search is the one way to learn whether an address has a Duet
// account, so it is rate limited per caller.
export const EMAIL_SEARCH_LIMIT = 20;
const EMAIL_SEARCH_WINDOW_MS = 60 * 60 * 1000;

function requireUid(auth: { uid: string } | undefined): string {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  return auth.uid;
}

/**
 * Find a user by exact email for friend requests. Replaces the client-side
 * RTDB query, which needed a rule letting any signed-in user read the matched
 * user's whole record (email, push tokens, preferences). Returns only the
 * public profile fields.
 */
export async function findUserByEmail(callerUid: string, rawEmail: unknown): Promise<PublicProfile | null> {
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
    throw new HttpsError('invalid-argument', 'Enter a valid email address.');
  }

  const allowed = await checkRateLimit(callerUid, 'email_search', EMAIL_SEARCH_LIMIT, EMAIL_SEARCH_WINDOW_MS);
  if (!allowed) {
    throw new HttpsError('resource-exhausted', 'Too many searches. Try again later.');
  }

  let uid: string;
  try {
    uid = (await getAuth().getUserByEmail(email)).uid;
  } catch (error: any) {
    if (error?.code === 'auth/user-not-found') return null;
    throw error;
  }
  if (uid === callerUid) return null;

  const profile = (await getDatabase().ref(`/users/${uid}/profile`).once('value')).val();
  if (!profile) return null;

  return {
    uid,
    displayName: profile.displayName || 'Duet User',
    avatarUrl: profile.avatarUrl || null,
  };
}

export const searchUserByEmail = onCall({ region: 'us-central1' }, async (request) => {
  const uid = requireUid(request.auth);
  return { user: await findUserByEmail(uid, request.data?.email) };
});
