import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = '@duet_location_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class LocationService {
  /**
   * Retrieves the current city via IP geolocation (Zero-Permission mapping).
   * Caches results heavily to avoid API limits.
   */
  static async fetchCity(): Promise<string | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { timestamp, city } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL_MS) {
          return city;
        }
      }

      const response = await fetch('https://ipapi.co/json/', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      if (data && data.city) {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          city: data.city,
        }));
        return data.city;
      }
      return null;
    } catch (e) {
      console.warn('[LocationService] Failed to determine location:', e);
      // Fallback to cache ignoring TTL if offline limits are hit
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        return JSON.parse(cached).city;
      }
      return null;
    }
  }
}
