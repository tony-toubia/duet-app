import database from '@react-native-firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const CACHE_KEY = '@duet_content_hub_cache';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes (shorter since syndication refreshes often)

export class ContentService {
  /**
   * Fetch active curated content, utilizing a local cache layer 
   * to avoid aggressive Firebase read billing.
   */
  static async fetchContent(forceRefresh = false): Promise<ContentItem[]> {
    try {
      if (!forceRefresh) {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const { timestamp, data } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL_MS) {
            return ContentService.filterExpired(data);
          }
        }
      }

      // Read from the new syndicated path, fall back to legacy path
      let snapshot = await database().ref('content_hub/items').once('value');
      if (!snapshot.exists()) {
        // Fallback to legacy path for backwards compatibility
        snapshot = await database().ref('worldcup/content').once('value');
      }

      const val = snapshot.val();
      if (!val) return [];

      const parsed: ContentItem[] = Object.keys(val).map(key => ({
        id: key,
        source: 'manual' as ContentSource, // Default for legacy items without a source field
        ...val[key]
      }));

      // Cache it
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: parsed
      }));

      return ContentService.filterExpired(
        parsed.sort((a, b) => b.createdAt - a.createdAt)
      );
    } catch (e) {
      console.warn('[ContentService] Failed to fetch content:', e);
      // Fallback to cache without TTL checking if network fails
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data } = JSON.parse(cached);
        return ContentService.filterExpired(data);
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
      item => !item.expiresAt || item.pinned || item.expiresAt > now
    );
  }

  static filterContentByCity(content: ContentItem[], city: string | null): ContentItem[] {
    if (!city) return content;
    // Map anything targeting the specific city or global (null city) to the top
    const localized = content.filter(c => c.city?.toLowerCase() === city.toLowerCase());
    const global = content.filter(c => !c.city || c.city.trim() === '');
    return [...localized, ...global];
  }
}

