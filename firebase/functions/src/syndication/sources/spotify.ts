/**
 * Spotify Syndication Source
 *
 * Fetches featured playlists using Spotify's Client Credentials flow.
 * No user login required — uses app-level auth.
 * https://developer.spotify.com/documentation/web-api
 */

import { type RawSyndicatedItem } from '../normalizer';

interface SpotifyPlaylist {
  id: string;
  name: string;
  description?: string;
  external_urls?: { spotify?: string };
  uri?: string;
  images?: Array<{ url: string; height?: number; width?: number }>;
  tracks?: { total?: number };
}

interface SpotifyConfig {
  clientId: string;
  clientSecret: string;
  categories?: string[];
  maxItems?: number;
}

// ─── Auth ────────────────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(
  clientId: string,
  clientSecret: string
): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Spotify auth error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}

// ─── Fetch helpers ───────────────────────────────────────────────────

async function fetchFeaturedPlaylists(
  token: string,
  limit: number
): Promise<SpotifyPlaylist[]> {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/browse/featured-playlists?limit=${limit}&country=US`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Spotify featured playlists error: ${response.status}`);
    }

    const data = await response.json();
    return data?.playlists?.items || [];
  } catch (e) {
    console.warn('[Spotify] Failed to fetch featured playlists:', e);
    return [];
  }
}

async function fetchCategoryPlaylists(
  token: string,
  categoryId: string,
  limit: number
): Promise<SpotifyPlaylist[]> {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/browse/categories/${categoryId}/playlists?limit=${limit}&country=US`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      // Category might not exist — that's ok
      console.warn(`[Spotify] Category ${categoryId} returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data?.playlists?.items || [];
  } catch (e) {
    console.warn(`[Spotify] Failed to fetch category ${categoryId}:`, e);
    return [];
  }
}

// ─── Transform ───────────────────────────────────────────────────────

function playlistToItem(playlist: SpotifyPlaylist): RawSyndicatedItem {
  const image = playlist.images?.[0]?.url || '';

  // Use spotify: URI for deep linking (opens in Spotify app)
  const deepLink = playlist.uri || playlist.external_urls?.spotify || '';

  const description = playlist.description
    ? playlist.description.replace(/<[^>]*>/g, '').substring(0, 200)
    : undefined;

  return {
    sourceId: `spotify_${playlist.id}`,
    type: 'playlist',
    title: playlist.name,
    description,
    deepLink,
    image,
    tags: ['playlist', 'spotify'],
    expiresAt: Date.now() + 3 * 24 * 60 * 60 * 1000, // Playlists last 3 days
  };
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Fetch playlist content from Spotify.
 */
export async function fetchSpotifyContent(
  config: SpotifyConfig
): Promise<RawSyndicatedItem[]> {
  const {
    clientId,
    clientSecret,
    categories = ['sports', 'party', 'chill'],
    maxItems = 8,
  } = config;

  console.log('[Spotify] Authenticating...');
  const token = await getAccessToken(clientId, clientSecret);

  const items: RawSyndicatedItem[] = [];

  // 1. Fetch featured playlists
  console.log('[Spotify] Fetching featured playlists...');
  const featured = await fetchFeaturedPlaylists(token, Math.min(maxItems, 10));
  for (const playlist of featured) {
    items.push(playlistToItem(playlist));
  }
  console.log(`[Spotify] Found ${featured.length} featured playlists`);

  // 2. Fetch category-specific playlists
  for (const category of categories) {
    if (items.length >= maxItems * 2) break; // Cap total before dedup
    console.log(`[Spotify] Fetching category: ${category}...`);
    const catPlaylists = await fetchCategoryPlaylists(token, category, 5);
    for (const playlist of catPlaylists) {
      items.push(playlistToItem(playlist));
    }
  }

  // Deduplicate by playlist ID and cap
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    if (seen.has(item.sourceId)) return false;
    seen.add(item.sourceId);
    return true;
  });

  return unique.slice(0, maxItems);
}
