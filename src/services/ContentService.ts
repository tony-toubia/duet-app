import database from '@react-native-firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ContentItem {
  id: string;
  type: 'podcast' | 'live_stream' | 'playlist';
  title: string;
  deepLink: string;
  image: string;
  city?: string;
  createdAt: number;
}

const CACHE_KEY = '@duet_content_hub_cache';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours cache

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
            return data;
          }
        }
      }

      const snapshot = await database().ref('worldcup/content').once('value');
      const val = snapshot.val();
      if (!val) return [];

      const parsed: ContentItem[] = Object.keys(val).map(key => ({
        id: key,
        ...val[key]
      }));

      // Cache it
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: parsed
      }));

      return parsed.sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
      console.warn('[ContentService] Failed to fetch content:', e);
      // Fallback to cache without TTL checking if network fails
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data } = JSON.parse(cached);
        return data;
      }
      return [];
    }
  }

  static filterContentByCity(content: ContentItem[], city: string | null): ContentItem[] {
    if (!city) return content;
    // Map anything targeting the specific city or global (null city) to the top
    const localized = content.filter(c => c.city?.toLowerCase() === city.toLowerCase());
    const global = content.filter(c => !c.city || c.city.trim() === '');
    return [...localized, ...global];
  }
}
