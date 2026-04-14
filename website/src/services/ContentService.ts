import { ref, get } from 'firebase/database';
import { firebaseDb } from './firebase';

export interface ContentItem {
  id: string;
  type: 'podcast' | 'live_stream' | 'playlist';
  title: string;
  deepLink: string;
  image: string;
  city?: string;
  createdAt: number;
}

const CACHE_KEY = 'duet_content_hub_cache';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

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
            return data;
          }
        }
      }

      const snapshot = await get(ref(firebaseDb, 'worldcup/content'));
      const val = snapshot.val();
      if (!val) return [];

      const parsed: ContentItem[] = Object.keys(val).map((key) => ({
        id: key,
        ...val[key],
      }));

      // Cache it
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ timestamp: Date.now(), data: parsed })
        );
      }

      return parsed.sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
      console.warn('[ContentService] Failed to fetch content:', e);
      // Fallback to cache without TTL checking
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          return JSON.parse(cached).data;
        }
      }
      return [];
    }
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
