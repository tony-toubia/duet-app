/**
 * TURN Server Configuration (Web)
 *
 * Production TURN credentials are read from Next.js public env vars.
 * Set NEXT_PUBLIC_TURN_SERVER_IP, NEXT_PUBLIC_TURN_USERNAME, and
 * NEXT_PUBLIC_TURN_PASSWORD in Vercel or .env.local.
 */

export interface TurnServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

function getProductionTurn(): TurnServer[] {
  const ip = process.env.NEXT_PUBLIC_TURN_SERVER_IP;
  const username = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const password = process.env.NEXT_PUBLIC_TURN_PASSWORD;

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

const STUN_SERVERS: TurnServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

/**
 * ICE servers for peer connections. Audio only ever relays through Duet's own
 * TURN server; there is deliberately no third-party relay fallback. If the
 * TURN env vars are missing, calls still connect directly where networks
 * allow, and fail rather than route audio through someone else's server.
 */
export function getIceServers(): TurnServer[] {
  const productionTurn = getProductionTurn();
  if (productionTurn.length === 0) {
    console.error('[TURN] NEXT_PUBLIC_TURN_* not set: no relay available, so peers behind strict NATs will not connect.');
  }
  return [...STUN_SERVERS, ...productionTurn];
}

export async function fetchDynamicTurnCredentials(
  backendUrl: string
): Promise<TurnServer[]> {
  try {
    const response = await fetch(`${backendUrl}/api/turn-credentials`);
    if (!response.ok) {
      throw new Error('Failed to fetch TURN credentials');
    }
    const { username, credential, urls } = await response.json();
    return [{ urls, username, credential }];
  } catch (error) {
    console.warn('[TURN] Failed to fetch dynamic credentials:', error);
    return [];
  }
}
