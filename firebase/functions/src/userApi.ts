/**
 * User-facing callable functions. Each one requires a signed-in caller
 * (guests included, since guests are anonymous Firebase users) and returns
 * only what the caller is allowed to see.
 */
import { createHmac } from 'crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { checkRateLimit } from './rateLimit';
import { deleteUserAccount } from './accountDeletion';

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

// ─── Relay (TURN) credentials ────────────────────────────────────────

const turnSharedSecret = defineSecret('TURN_SHARED_SECRET');

export const TURN_CREDENTIAL_TTL_SECONDS = 24 * 60 * 60;
const TURN_REQUEST_LIMIT = 120;
const TURN_REQUEST_WINDOW_MS = 60 * 60 * 1000;

export interface TurnConfig {
  /** Relay host or IP (TURN_HOST). */
  host: string;
  /** Optional TLS hostname with a valid certificate (TURN_TLS_HOST). */
  tlsHost?: string;
  /**
   * "secret": coturn runs with use-auth-secret and we mint short-lived
   * credentials (the TURN REST API scheme). "static": transition mode for
   * a server still using one shared user=; the credential is served to
   * signed-in users instead of being baked into app and web bundles.
   */
  mode: 'secret' | 'static';
  sharedSecret?: string;
  staticUsername?: string;
  staticPassword?: string;
}

export interface IssuedTurnCredentials {
  iceServers: { urls: string[]; username: string; credential: string }[];
  /** Unix ms after which the client should fetch new credentials. */
  expiresAt: number;
}

export function turnConfigFromEnv(sharedSecret: string | undefined): TurnConfig {
  return {
    host: (process.env.TURN_HOST || '').trim(),
    tlsHost: (process.env.TURN_TLS_HOST || '').trim() || undefined,
    mode: process.env.TURN_AUTH_MODE === 'static' ? 'static' : 'secret',
    sharedSecret,
    staticUsername: process.env.TURN_STATIC_USERNAME,
    staticPassword: process.env.TURN_STATIC_PASSWORD,
  };
}

/**
 * Build relay credentials for one user. In "secret" mode the username is
 * "<expiry unix seconds>:<uid>" and the password is
 * base64(HMAC-SHA1(shared secret, username)), which coturn verifies with the
 * same secret, so credentials expire on their own and each one is
 * attributable to an account in relay logs.
 */
export function issueTurnCredentials(uid: string, config: TurnConfig, nowMs = Date.now()): IssuedTurnCredentials {
  if (!config.host) throw new HttpsError('failed-precondition', 'Relay is not configured.');

  const urls = [`turn:${config.host}:3478?transport=udp`, `turn:${config.host}:3478?transport=tcp`];
  if (config.tlsHost) urls.push(`turns:${config.tlsHost}:5349?transport=tcp`);

  if (config.mode === 'static') {
    if (!config.staticUsername || !config.staticPassword) {
      throw new HttpsError('failed-precondition', 'Relay is not configured.');
    }
    return {
      iceServers: [{ urls, username: config.staticUsername, credential: config.staticPassword }],
      // Re-fetch daily so clients pick up the switch to "secret" mode
      expiresAt: nowMs + TURN_CREDENTIAL_TTL_SECONDS * 1000,
    };
  }

  if (!config.sharedSecret) throw new HttpsError('failed-precondition', 'Relay is not configured.');
  const expiry = Math.floor(nowMs / 1000) + TURN_CREDENTIAL_TTL_SECONDS;
  const username = `${expiry}:${uid}`;
  const credential = createHmac('sha1', config.sharedSecret).update(username).digest('base64');
  return { iceServers: [{ urls, username, credential }], expiresAt: expiry * 1000 };
}

export const getTurnCredentials = onCall(
  { region: 'us-central1', secrets: [turnSharedSecret] },
  async (request) => {
    const uid = requireUid(request.auth);
    const allowed = await checkRateLimit(uid, 'turn_credentials', TURN_REQUEST_LIMIT, TURN_REQUEST_WINDOW_MS);
    if (!allowed) throw new HttpsError('resource-exhausted', 'Too many requests. Try again later.');
    return issueTurnCredentials(uid, turnConfigFromEnv(turnSharedSecret.value()));
  }
);

// ─── Account deletion ────────────────────────────────────────────────

/**
 * Permanently delete the caller's account and data (Apple guideline
 * 5.1.1(v); also available to guests). The app asks for confirmation first.
 */
export const deleteAccount = onCall({ region: 'us-central1', timeoutSeconds: 120 }, async (request) => {
  const uid = requireUid(request.auth);
  if (request.data?.confirm !== 'DELETE') {
    throw new HttpsError('invalid-argument', 'Deletion was not confirmed.');
  }
  const allowed = await checkRateLimit(uid, 'delete_account', 5, 60 * 60 * 1000);
  if (!allowed) throw new HttpsError('resource-exhausted', 'Too many requests. Try again later.');
  return deleteUserAccount(uid);
});
