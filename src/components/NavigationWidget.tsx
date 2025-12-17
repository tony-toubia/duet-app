import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Linking, Platform, TouchableOpacity, AppState, AppStateStatus } from 'react-native';

// Colors (matching main app)
const colors = {
  surface: '#16213e',
  text: '#ffffff',
  textMuted: '#a0a0a0',
  primary: '#e94560',
  secondary: '#0f3460',
  success: '#4ade80',
};

type NavApp = 'google_maps' | 'apple_maps' | 'waze';

interface InstalledApps {
  google_maps: boolean;
  apple_maps: boolean;
  waze: boolean;
}

/**
 * NavigationWidget - Quick access to navigation apps
 *
 * Shows installed navigation apps and provides quick launch buttons.
 * When returning from a nav app, shows a prominent "Return to Navigation" button.
 */
export const NavigationWidget: React.FC = () => {
  const [installedApps, setInstalledApps] = useState<InstalledApps>({
    google_maps: false,
    apple_maps: Platform.OS === 'ios', // Apple Maps always available on iOS
    waze: false,
  });
  const [lastUsedApp, setLastUsedApp] = useState<NavApp | null>(null);
  const [recentlyReturnedFromNav, setRecentlyReturnedFromNav] = useState(false);

  // Check which nav apps are installed
  const checkInstalledApps = useCallback(async () => {
    const googleMapsUrl = Platform.OS === 'ios' ? 'comgooglemaps://' : 'google.navigation:q=test';
    const wazeUrl = 'waze://';

    const [hasGoogleMaps, hasWaze] = await Promise.all([
      Linking.canOpenURL(googleMapsUrl).catch(() => false),
      Linking.canOpenURL(wazeUrl).catch(() => false),
    ]);

    setInstalledApps({
      google_maps: hasGoogleMaps,
      apple_maps: Platform.OS === 'ios',
      waze: hasWaze,
    });
  }, []);

  useEffect(() => {
    checkInstalledApps();
  }, [checkInstalledApps]);

  // Track when user returns to app (possibly from navigation)
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active' && lastUsedApp) {
        // User returned to app after using navigation
        setRecentlyReturnedFromNav(true);
        // Clear the "return" prompt after 30 seconds
        setTimeout(() => setRecentlyReturnedFromNav(false), 30000);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [lastUsedApp]);

  // Open navigation app
  const openNavApp = async (app: NavApp) => {
    let url = '';

    switch (app) {
      case 'google_maps':
        // Open Google Maps - if there's active navigation it will resume
        url = Platform.OS === 'ios' ? 'comgooglemaps://' : 'google.navigation:';
        break;
      case 'apple_maps':
        url = 'maps://';
        break;
      case 'waze':
        url = 'waze://';
        break;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        setLastUsedApp(app);
        setRecentlyReturnedFromNav(false);
        await Linking.openURL(url);
      } else {
        // Fallback to web/store
        const fallbackUrls: Record<NavApp, string> = {
          google_maps: 'https://maps.google.com',
          waze: 'https://waze.com',
          apple_maps: 'https://maps.apple.com',
        };
        await Linking.openURL(fallbackUrls[app]);
      }
    } catch (error) {
      console.log('Failed to open navigation app:', error);
    }
  };

  const getAppName = (app: NavApp): string => {
    switch (app) {
      case 'google_maps': return 'Google Maps';
      case 'apple_maps': return 'Apple Maps';
      case 'waze': return 'Waze';
    }
  };

  const getAppIcon = (app: NavApp): string => {
    switch (app) {
      case 'google_maps': return '📍';
      case 'apple_maps': return '🗺️';
      case 'waze': return '🚗';
    }
  };

  // Get list of installed apps for display
  const availableApps = (Object.keys(installedApps) as NavApp[]).filter(
    app => installedApps[app]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Navigation</Text>

      {/* Show "Return to Navigation" if user recently came back from a nav app */}
      {recentlyReturnedFromNav && lastUsedApp && (
        <TouchableOpacity
          style={styles.returnButton}
          onPress={() => openNavApp(lastUsedApp)}
        >
          <Text style={styles.returnIcon}>{getAppIcon(lastUsedApp)}</Text>
          <View style={styles.returnTextContainer}>
            <Text style={styles.returnTitle}>Return to Navigation</Text>
            <Text style={styles.returnSubtitle}>{getAppName(lastUsedApp)}</Text>
          </View>
          <Text style={styles.returnArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Quick launch buttons */}
      <View style={styles.quickLaunch}>
        {!recentlyReturnedFromNav && (
          <Text style={styles.quickLaunchLabel}>Open Navigation</Text>
        )}
        <View style={styles.navButtons}>
          {availableApps.map(app => (
            <TouchableOpacity
              key={app}
              style={[
                styles.navButton,
                lastUsedApp === app && styles.navButtonLastUsed,
              ]}
              onPress={() => openNavApp(app)}
            >
              <Text style={styles.navButtonIcon}>{getAppIcon(app)}</Text>
              <Text style={styles.navButtonText}>
                {app === 'google_maps' ? 'Google' : app === 'apple_maps' ? 'Apple' : 'Waze'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  title: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  // Return to Navigation button
  returnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.success,
  },
  returnIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  returnTextContainer: {
    flex: 1,
  },
  returnTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  returnSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  returnArrow: {
    color: colors.success,
    fontSize: 24,
    fontWeight: 'bold',
  },
  // Quick launch section
  quickLaunch: {
    alignItems: 'center',
  },
  quickLaunchLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 8,
  },
  navButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  navButton: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    minWidth: 65,
  },
  navButtonLastUsed: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  navButtonIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  navButtonText: {
    color: colors.text,
    fontSize: 11,
  },
});

export default NavigationWidget;
