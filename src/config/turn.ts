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
 * Fallback TURN servers (free, but less reliable for production)
 */
const FALLBACK_TURN: TurnServer[] = [
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

/**
 * STUN servers (free, no auth needed)
 */
const STUN_SERVERS: TurnServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

/**
 * Get the full ICE server configuration
 */
export function getIceServers(): TurnServer[] {
  // Use production TURN if configured, otherwise fall back
  const productionTurn = getProductionTurn();
  const turnServers = productionTurn.length > 0 ? productionTurn : FALLBACK_TURN;

  return [...STUN_SERVERS, ...turnServers];
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
    console.warn('[TURN] Failed to fetch dynamic credentials, using fallback:', error);
    return FALLBACK_TURN;
  }
}

export default {
  getIceServers,
  fetchDynamicTurnCredentials,
};
