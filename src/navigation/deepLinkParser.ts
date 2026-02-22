/**
 * Parsed deep link result.
 * Each variant maps to a screen + params in RootStackParamList.
 */
export type DeepLinkAction =
  | { screen: 'Lobby'; params?: undefined }
  | { screen: 'Lobby'; params: { autoJoinCode: string } }
  | { screen: 'Profile'; params?: undefined }
  | { screen: 'Friends'; params?: undefined }
  | { type: 'external'; url: string };

/**
 * Parse a getduet.app web path into a navigation action.
 * Returns null for unrecognized paths (falls back to browser).
 */
function parseWebPath(pathname: string): DeepLinkAction | null {
  const path = pathname.replace(/\/+$/, '').toLowerCase();

  if (path === '/app' || path === '/app/lobby') {
    return { screen: 'Lobby' };
  }

  const roomMatch = pathname.match(/^\/app\/room\/([A-Za-z0-9]+)/i);
  if (roomMatch) {
    return { screen: 'Lobby', params: { autoJoinCode: roomMatch[1].toUpperCase() } };
  }

  if (path === '/app/friends') {
    return { screen: 'Friends' };
  }

  if (path === '/app/profile') {
    return { screen: 'Profile' };
  }

  return null;
}

/**
 * Parse a deep link URL into a navigation action.
 * Returns null if the URL is not a recognized deep link.
 *
 * Supported:
 *   duet://lobby                          -> Lobby screen
 *   duet://room/{code}                    -> Lobby with autoJoinCode
 *   duet://profile                        -> Profile screen
 *   duet://friends                        -> Friends screen
 *   https://getduet.app/app/*             -> Mapped to native screens (universal links)
 *   http(s)://... (other domains)         -> Open in system browser
 */
export function parseDeepLink(url: string): DeepLinkAction | null {
  if (!url) return null;

  // Handle http(s):// URLs — check for getduet.app universal links first
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'getduet.app' || parsed.hostname === 'www.getduet.app') {
        const action = parseWebPath(parsed.pathname);
        if (action) return action;
      }
    } catch {}
    // Non-getduet.app or unrecognized path → open in browser
    return { type: 'external', url };
  }

  // Handle duet:// custom scheme
  if (!url.startsWith('duet://')) return null;

  const path = url.replace('duet://', '').replace(/\/+$/, '').toLowerCase();

  if (path === 'lobby' || path === '') {
    return { screen: 'Lobby' };
  }

  if (path.startsWith('room/')) {
    const code = url.replace(/^duet:\/\/room\//i, '').replace(/\/+$/, '').toUpperCase();
    return code ? { screen: 'Lobby', params: { autoJoinCode: code } } : { screen: 'Lobby' };
  }

  if (path === 'profile') {
    return { screen: 'Profile' };
  }

  if (path === 'friends') {
    return { screen: 'Friends' };
  }

  // Unknown duet:// path — fallback to lobby
  return { screen: 'Lobby' };
}
