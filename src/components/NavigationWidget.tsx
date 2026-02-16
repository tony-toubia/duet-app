import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, ImageSourcePropType, StyleSheet, Linking, Platform, TouchableOpacity, AppState, AppStateStatus } from 'react-native';
import { colors } from '@/theme';

// All supported quick-launch apps
type AppId =
  | 'spotify'
  | 'apple_music'
  | 'youtube'
  | 'youtube_music'
  | 'google_maps'
  | 'apple_maps'
  | 'waze';

interface AppInfo {
  id: AppId;
  label: string;
  icon: ImageSourcePropType;
  urlScheme: string;
  iosUrlScheme?: string; // override for iOS if different
  androidUrlScheme?: string; // override for Android if different
  iosOnly?: boolean;
  fallbackUrl: string;
}

const ALL_APPS: AppInfo[] = [
  {
    id: 'spotify',
    label: 'Spotify',
    icon: require('../../assets/icons/spotify.png'),
    urlScheme: 'spotify://',
    fallbackUrl: 'https://open.spotify.com',
  },
  {
    id: 'apple_music',
    label: 'Music',
    icon: require('../../assets/icons/apple_music.png'),
    urlScheme: 'music://',
    iosOnly: true,
    fallbackUrl: 'https://music.apple.com',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    icon: require('../../assets/icons/youtube.png'),
    urlScheme: 'youtube://',
    fallbackUrl: 'https://youtube.com',
  },
  {
    id: 'youtube_music',
    label: 'YT Music',
    icon: require('../../assets/icons/youtube_music.png'),
    urlScheme: 'youtubemusic://',
    fallbackUrl: 'https://music.youtube.com',
  },
  {
    id: 'google_maps',
    label: 'Maps',
    icon: require('../../assets/icons/google_maps.png'),
    urlScheme: 'comgooglemaps://',
    androidUrlScheme: 'google.navigation:',
    fallbackUrl: 'https://maps.google.com',
  },
  {
    id: 'apple_maps',
    label: 'Maps',
    icon: require('../../assets/icons/apple_maps.png'),
    urlScheme: 'maps://',
    iosOnly: true,
    fallbackUrl: 'https://maps.apple.com',
  },
  {
    id: 'waze',
    label: 'Waze',
    icon: require('../../assets/icons/waze.png'),
    urlScheme: 'waze://',
    fallbackUrl: 'https://waze.com',
  },
];

/**
 * QuickLaunchWidget - Dynamically detects installed apps and shows quick-launch buttons.
 * Combines media apps (Spotify, Apple Music, YouTube, etc.) with navigation apps.
 */
export const NavigationWidget: React.FC = () => {
  const [installedApps, setInstalledApps] = useState<Set<AppId>>(new Set());
  const [lastUsedApp, setLastUsedApp] = useState<AppId | null>(null);
  const [recentlyReturned, setRecentlyReturned] = useState(false);

  const getUrlScheme = useCallback((app: AppInfo): string => {
    if (Platform.OS === 'ios' && app.iosUrlScheme) return app.iosUrlScheme;
    if (Platform.OS === 'android' && app.androidUrlScheme) return app.androidUrlScheme;
    return app.urlScheme;
  }, []);

  // Check which apps are installed
  const detectApps = useCallback(async () => {
    const candidates = ALL_APPS.filter(app => {
      if (app.iosOnly && Platform.OS !== 'ios') return false;
      return true;
    });

    const results = await Promise.all(
      candidates.map(async (app) => {
        // Apple Music / Apple Maps are always available on iOS
        if (Platform.OS === 'ios' && (app.id === 'apple_music' || app.id === 'apple_maps')) {
          return { id: app.id, installed: true };
        }
        try {
          const url = getUrlScheme(app);
          const can = await Linking.canOpenURL(url);
          return { id: app.id, installed: can };
        } catch {
          return { id: app.id, installed: false };
        }
      })
    );

    const found = new Set<AppId>();
    results.forEach(r => { if (r.installed) found.add(r.id); });
    setInstalledApps(found);
  }, [getUrlScheme]);

  useEffect(() => {
    detectApps();
  }, [detectApps]);

  // Track when user returns from an external app
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active' && lastUsedApp) {
        setRecentlyReturned(true);
        setTimeout(() => setRecentlyReturned(false), 30000);
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub?.remove();
  }, [lastUsedApp]);

  const openApp = async (appId: AppId) => {
    const app = ALL_APPS.find(a => a.id === appId);
    if (!app) return;

    try {
      const url = getUrlScheme(app);
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        setLastUsedApp(appId);
        setRecentlyReturned(false);
        await Linking.openURL(url);
      } else {
        await Linking.openURL(app.fallbackUrl);
      }
    } catch (error) {
      console.log('Failed to open app:', error);
    }
  };

  const getAppInfo = (id: AppId) => ALL_APPS.find(a => a.id === id)!;

  // Split into media and nav categories
  const mediaAppIds: AppId[] = ['spotify', 'apple_music', 'youtube', 'youtube_music'];
  const navAppIds: AppId[] = ['google_maps', 'apple_maps', 'waze'];

  const installedMedia = mediaAppIds.filter(id => installedApps.has(id));
  const installedNav = navAppIds.filter(id => installedApps.has(id));

  // Always show at least Spotify and Google Maps as fallbacks (they open in browser)
  const displayMedia = installedMedia.length > 0 ? installedMedia : ['spotify' as AppId];
  const displayNav = installedNav.length > 0 ? installedNav : ['google_maps' as AppId];
  const displayApps = [...displayMedia, ...displayNav];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick Launch</Text>

      {/* Return-to button */}
      {recentlyReturned && lastUsedApp && (
        <TouchableOpacity
          style={styles.returnButton}
          onPress={() => openApp(lastUsedApp)}
        >
          <Image source={getAppInfo(lastUsedApp).icon} style={styles.returnIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.returnTitle}>Return to {getAppInfo(lastUsedApp).label}</Text>
          </View>
          <Text style={styles.returnArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* App buttons in a flex-wrap row */}
      <View style={styles.appsRow}>
        {displayApps.map(id => {
          const app = getAppInfo(id);
          return (
            <TouchableOpacity
              key={id}
              style={[
                styles.appButton,
                lastUsedApp === id && styles.appButtonLastUsed,
              ]}
              onPress={() => openApp(id)}
            >
              <Image source={app.icon} style={styles.appIcon} />
              <Text style={styles.appLabel}>{app.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginHorizontal: 20,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 10,
  },
  returnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.success,
  },
  returnIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    marginRight: 10,
  },
  returnTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  returnArrow: {
    color: colors.success,
    fontSize: 20,
    fontWeight: 'bold',
  },
  appsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  appButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    minWidth: 58,
  },
  appButtonLastUsed: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  appIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    marginBottom: 3,
  },
  appLabel: {
    color: colors.text,
    fontSize: 10,
  },
});

export default NavigationWidget;
