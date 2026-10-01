/**
 * TURN Server Configuration
 *
 * Production TURN credentials are read from EAS environment variables
 * via expo-constants. Set TURN_SERVER_IP, TURN_USERNAME, and TURN_PASSWORD
 * as EAS environment variables.
 */

import Constants from 'expo-constants';

export interface TurnServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface TurnConfig {
  iceServers: TurnServer[];
}

/**
 * Production TURN server configuration
 * Reads from EAS environment variables via app.config.js extra
 */
function getProductionTurn(): TurnServer[] {
  const ip = Constants.expoConfig?.extra?.turnServerIp;
  const username = Constants.expoConfig?.extra?.turnUsername;
  const password = Constants.expoConfig?.extra?.turnPassword;

  if (!ip || !username || !password) {
    return [];
  }

  return [
    {
      urls: `turn:${ip}:3478`,
      username,
      credential: password,
    },
    {
      urls: `turn:${ip}:3478?transport=tcp`,
      username,
      credential: password,
    },
  ];
}

/**
 * STUN servers (free, no auth needed)
 */
const STUN_SERVERS: TurnServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

/**
 * Whether Duet's TURN relay credentials are configured. Without them there is
 * no relay at all, so this is surfaced in lifecycle logs to make a build
 * missing its EAS env vars visible in the field.
 */
export function hasProductionTurn(): boolean {
  return getProductionTurn().length > 0;
}

/**
 * Get the full ICE server configuration
 */
export function getIceServers(): TurnServer[] {
  // Use production TURN if configured, otherwise fall back
  // Audio only ever relays through Duet's own TURN server; there is
  // deliberately no third-party relay fallback. Without the TURN env vars,
  // calls still connect directly where networks allow, and fail rather than
  // route audio through someone else's server.
  const productionTurn = getProductionTurn();
  console.log(`[TURN] ${productionTurn.length} TURN, ${STUN_SERVERS.length} STUN servers`);
  if (productionTurn.length === 0) {
    console.error('[TURN] TURN env vars not set: no relay available, so peers behind strict NATs will not connect.');
  }
  return [...STUN_SERVERS, ...productionTurn];
}

/**
 * Check if any relay candidates were found during ICE gathering.
 * Call after ICE gathering is complete to detect TURN failures.
 */
export function diagnoseTurnFailure(candidates: Array<{ candidate: string }>): {
  hasRelay: boolean;
  hasSrflx: boolean;
  hasHost: boolean;
  diagnosis: string;
} {
  let hasRelay = false;
  let hasSrflx = false;
  let hasHost = false;

  for (const c of candidates) {
    const typ = c.candidate?.split(' ')[7];
    if (typ === 'relay') hasRelay = true;
    if (typ === 'srflx') hasSrflx = true;
    if (typ === 'host') hasHost = true;
  }

  let diagnosis = '';
  if (!hasRelay && !hasSrflx) {
    diagnosis = 'No TURN/STUN candidates found. Check your network connection and firewall settings.';
  } else if (!hasRelay) {
    diagnosis = 'No TURN relay candidates. Users behind strict firewalls may have trouble connecting.';
  }

  return { hasRelay, hasSrflx, hasHost, diagnosis };
}

/**
 * For backends that generate time-limited credentials,
 * call this function to fetch fresh credentials
 */
export async function fetchDynamicTurnCredentials(
  backendUrl: string
): Promise<TurnServer[]> {
  try {
    const response = await fetch(`${backendUrl}/api/turn-credentials`);
    if (!response.ok) {
      throw new Error('Failed to fetch TURN credentials');
    }
    const { username, credential, urls } = await response.json();
    return [
      {
        urls,
        username,
        credential,
      },
    ];
  } catch (error) {
    console.warn('[TURN] Failed to fetch dynamic credentials:', error);
    return [];
  }
}

export default {
  getIceServers,
  fetchDynamicTurnCredentials,
  diagnoseTurnFailure,
};
