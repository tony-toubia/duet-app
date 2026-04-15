/**
 * Podcast Index Syndication Source
 *
 * Fetches trending and popular podcast episodes from the Podcast Index API.
 * Free & open: https://podcastindex.org/
 *
 * Auth: API Key + Secret in Authorization header with SHA-1 hash.
 */

import * as crypto from 'crypto';
import { type RawSyndicatedItem } from '../normalizer';

interface PodcastIndexEpisode {
  id: number;
  feedId: number;
  title: string;
  description?: string;
  link?: string;
  enclosureUrl?: string;
  image?: string;
  feedImage?: string;
  feedTitle?: string;
  categories?: Record<string, string>;
  datePublished?: number;
}

interface PodcastIndexConfig {
  apiKey: string;
  apiSecret: string;
  categories?: string[];
  maxItems?: number;
}

// ─── Auth helper ─────────────────────────────────────────────────────

function buildHeaders(apiKey: string, apiSecret: string): Record<string, string> {
  const now = Math.floor(Date.now() / 1000);
  const hash = crypto
    .createHash('sha1')
    .update(`${apiKey}${apiSecret}${now}`)
    .digest('hex');

  return {
    'X-Auth-Key': apiKey,
    'X-Auth-Date': String(now),
    Authorization: hash,
    'User-Agent': 'Duet/1.0',
  };
}

// ─── Fetch helpers ───────────────────────────────────────────────────

async function fetchTrending(
  apiKey: string,
  apiSecret: string,
  max: number,
  categories?: string[]
): Promise<PodcastIndexEpisode[]> {
  try {
    let url = `https://api.podcastindex.org/api/1.0/episodes/random?max=${max}&lang=en`;
    if (categories && categories.length > 0) {
      url += `&cat=${encodeURIComponent(categories.join(','))}`;
    }

    const response = await fetch(url, {
      headers: buildHeaders(apiKey, apiSecret),
    });

    if (!response.ok) {
      throw new Error(`PodcastIndex API error: ${response.status}`);
    }

    const data = await response.json();
    return data?.episodes || [];
  } catch (e) {
    console.warn('[PodcastIndex] Failed to fetch trending:', e);
    return [];
  }
}

async function searchPodcasts(
  apiKey: string,
  apiSecret: string,
  query: string,
  max: number
): Promise<PodcastIndexEpisode[]> {
  try {
    const url = `https://api.podcastindex.org/api/1.0/search/byterm?q=${encodeURIComponent(
      query
    )}&max=${max}`;

    const response = await fetch(url, {
      headers: buildHeaders(apiKey, apiSecret),
    });

    if (!response.ok) {
      throw new Error(`PodcastIndex search error: ${response.status}`);
    }

    const data = await response.json();
    // Search returns feeds, not episodes. Map them.
    return (data?.feeds || []).map((feed: any) => ({
      id: feed.id,
      feedId: feed.id,
      title: feed.title,
      description: feed.description,
      link: feed.link,
      image: feed.image || feed.artwork,
      feedImage: feed.artwork,
      feedTitle: feed.title,
    }));
  } catch (e) {
    console.warn('[PodcastIndex] Search failed:', e);
    return [];
  }
}

// ─── Transform ───────────────────────────────────────────────────────

function episodeToItem(episode: PodcastIndexEpisode): RawSyndicatedItem {
  const title = episode.feedTitle
    ? `${episode.feedTitle}: ${episode.title}`
    : episode.title;

  const image = episode.image || episode.feedImage || '';

  // Deep link: prefer enclosure (actual audio), then link
  const deepLink = episode.link || episode.enclosureUrl || '';

  return {
    sourceId: `podcastindex_${episode.id}`,
    type: 'podcast',
    title: title.length > 100 ? title.substring(0, 97) + '...' : title,
    description: episode.description
      ? episode.description.replace(/<[^>]*>/g, '').substring(0, 200)
      : undefined,
    deepLink,
    image,
    tags: ['podcast'],
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // Podcasts last 7 days
  };
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Fetch podcast content from the Podcast Index API.
 */
export async function fetchPodcastContent(
  config: PodcastIndexConfig
): Promise<RawSyndicatedItem[]> {
  const { apiKey, apiSecret, categories = ['Sports', 'Comedy'], maxItems = 10 } = config;
  const items: RawSyndicatedItem[] = [];

  // 1. Fetch random/trending episodes
  console.log('[PodcastIndex] Fetching trending episodes...');
  const trending = await fetchTrending(apiKey, apiSecret, maxItems, categories);
  for (const ep of trending) {
    if (ep.title && (ep.link || ep.enclosureUrl)) {
      items.push(episodeToItem(ep));
    }
  }
  console.log(`[PodcastIndex] Found ${items.length} episodes`);

  // 2. If we got fewer than desired, supplement with search
  if (items.length < maxItems) {
    const searchQueries = ['sports talk', 'watch party', 'game day'];
    for (const query of searchQueries) {
      if (items.length >= maxItems) break;
      console.log(`[PodcastIndex] Supplementing with search: "${query}"`);
      const results = await searchPodcasts(
        apiKey,
        apiSecret,
        query,
        maxItems - items.length
      );
      for (const ep of results) {
        if (ep.title) {
          items.push(episodeToItem(ep));
        }
      }
    }
  }

  return items.slice(0, maxItems);
}
