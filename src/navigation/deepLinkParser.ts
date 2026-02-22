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
 * Parse a deep link URL into a navigation action.
 * Returns null if the URL is not a recognized deep link.
 *
 * Supported:
 *   duet://lobby         -> Lobby screen
 *   duet://room/{code}   -> Lobby with autoJoinCode
 *   duet://profile       -> Profile screen
 *   duet://friends       -> Friends screen
 *   http(s)://...        -> Open in system browser
 */
export function parseDeepLink(url: string): DeepLinkAction | null {
  if (!url) return null;

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return { type: 'external', url };
  }

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
