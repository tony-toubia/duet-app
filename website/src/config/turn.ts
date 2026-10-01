/**
 * Relay (TURN) and STUN configuration (Web).
 *
 * Relay credentials are fetched at runtime from the getTurnCredentials Cloud
 * Function; no relay host or password is inlined into the public JS bundle
 * (the old NEXT_PUBLIC_TURN_* variables are no longer read).
 */

import { callFunction } from '@/services/CloudFunctions';

export interface TurnServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * STUN servers (free, no auth needed). They tell each device its public
 * address so a direct connection can be attempted; they never see audio.
 */
const STUN_SERVERS: TurnServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

// Short-lived relay credentials from the getTurnCredentials Cloud Function.
// Nothing about the relay is baked into the app or web bundle any more: the
// server mints per-user credentials that expire after 24 hours.
let relayServers: TurnServer[] = [];
let relayExpiresAt = 0;
let inflight: Promise<boolean> | null = null;

// Refresh an hour before expiry so a long call's ICE restart gets fresh ones
const REFRESH_MARGIN_MS = 60 * 60 * 1000;
// Don't hold up a call for a slow cold start: connect without the relay
// rather than not at all, and pick the credentials up on the next attempt
const FETCH_TIMEOUT_MS = 8000;

function relayValid(): boolean {
  return relayServers.length > 0 && Date.now() < relayExpiresAt - REFRESH_MARGIN_MS;
}

/**
 * Make sure relay credentials are cached and not close to expiry. Resolves
 * true when new credentials were fetched (callers with a live connection
 * should then apply them), false when the cache was already good or the
 * fetch failed. Never rejects.
 */
export function ensureTurnCredentials(): Promise<boolean> {
  if (relayValid()) return Promise.resolve(false);
  if (!inflight) {
    const fetchCreds = callFunction<{ iceServers: TurnServer[]; expiresAt: number }>('getTurnCredentials')
      .then((res) => {
        relayServers = Array.isArray(res?.iceServers) ? res.iceServers : [];
        relayExpiresAt = typeof res?.expiresAt === 'number' ? res.expiresAt : 0;
        return relayServers.length > 0;
      })
      .catch((error) => {
        console.error('[TURN] Could not fetch relay credentials; only direct connections will work:', error);
        return false;
      });
    const timeout = new Promise<boolean>((resolve) =>
      setTimeout(() => {
        if (!relayValid()) console.error('[TURN] Relay credentials request timed out');
        resolve(false);
      }, FETCH_TIMEOUT_MS)
    );
    inflight = Promise.race([fetchCreds, timeout]).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/**
 * Whether relay credentials are currently available. Surfaced in lifecycle
 * logs so connections made without a relay are visible in the field.
 */
export function hasProductionTurn(): boolean {
  return relayServers.length > 0 && Date.now() < relayExpiresAt;
}

/**
 * ICE servers for a peer connection. Audio only ever relays through Duet's
 * own TURN server; there is deliberately no third-party relay fallback.
 * Call ensureTurnCredentials() first so the relay is included.
 */
export function getIceServers(): TurnServer[] {
  const relay = Date.now() < relayExpiresAt ? relayServers : [];
  if (relay.length === 0) {
    console.error('[TURN] No relay credentials: peers behind strict NATs will not connect.');
  }
  return [...STUN_SERVERS, ...relay];
}
