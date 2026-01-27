/**
 * TURN Server Configuration
 *
 * For production, replace the fallback servers with your own coturn deployment.
 * See /server/README.md for deployment instructions.
 */

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
 *
 * To use your own TURN server:
 * 1. Deploy coturn using /server/docker-compose.yml
 * 2. Update the values below
 * 3. For dynamic credentials, fetch from your backend instead
 */
const PRODUCTION_TURN: TurnServer[] = [
  // Your own TURN server (uncomment and configure)
  // {
  //   urls: 'turn:turn.yourdomain.com:3478',
  //   username: 'duet',
  //   credential: 'YOUR_TURN_PASSWORD',
  // },
  // {
  //   urls: 'turn:turn.yourdomain.com:5349?transport=tcp',
  //   username: 'duet',
  //   credential: 'YOUR_TURN_PASSWORD',
  // },
];

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
  const turnServers = PRODUCTION_TURN.length > 0 ? PRODUCTION_TURN : FALLBACK_TURN;

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
