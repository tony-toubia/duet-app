import { ref, get } from 'firebase/database';
import { firebaseDb } from './firebase';

export type ContentType = 'podcast' | 'live_stream' | 'playlist';
export type ContentSource = 'manual' | 'sportsdb' | 'podcastindex' | 'spotify';

export interface ContentItem {
  id: string;
  type: ContentType;
  title: string;
  description?: string;
  deepLink: string;
  image: string;
  city?: string;
  tags?: string[];
  league?: string;
  source: ContentSource;
  sourceId?: string;
  expiresAt?: number;
  pinned?: boolean;
  createdAt: number;
}

const CACHE_KEY = 'duet_content_hub_cache';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes (shorter since syndication refreshes often)

export class ContentService {
  /**
   * Fetch active curated content with a localStorage cache layer
   * to reduce Firebase read billing.
   */
  static async fetchContent(forceRefresh = false): Promise<ContentItem[]> {
    try {
      if (!forceRefresh && typeof window !== 'undefined') {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { timestamp, data } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL_MS) {
            return ContentService.filterExpired(data);
          }
        }
      }

      // Read from the new syndicated path, fall back to legacy path
      let snapshot = await get(ref(firebaseDb, 'content_hub/items'));
      if (!snapshot.exists()) {
        // Fallback to legacy path for backwards compatibility
        snapshot = await get(ref(firebaseDb, 'worldcup/content'));
      }

      const val = snapshot.val();
      if (!val) return [];

      const parsed: ContentItem[] = Object.keys(val).map((key) => ({
        id: key,
        source: 'manual', // Default for legacy items without a source field
        ...val[key],
      }));

      // Cache it
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ timestamp: Date.now(), data: parsed })
        );
      }

      return ContentService.filterExpired(
        parsed.sort((a, b) => b.createdAt - a.createdAt)
      );
    } catch (e) {
      console.warn('[ContentService] Failed to fetch content:', e);
      // Fallback to cache without TTL checking
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          return ContentService.filterExpired(JSON.parse(cached).data);
        }
      }
      return [];
    }
  }

  /**
   * Filter out expired syndicated items (client-side safety net).
   */
  static filterExpired(content: ContentItem[]): ContentItem[] {
    const now = Date.now();
    return content.filter(
      (item) => !item.expiresAt || item.pinned || item.expiresAt > now
    );
  }

  static filterContentByCity(
    content: ContentItem[],
    city: string | null
  ): ContentItem[] {
    if (!city) return content;
    const localized = content.filter(
      (c) => c.city?.toLowerCase() === city.toLowerCase()
    );
    const global = content.filter((c) => !c.city || c.city.trim() === '');
    return [...localized, ...global];
  }
}

