/**
 * Push Notification Service
 *
 * Handles registration and handling of push notifications for:
 * - Partner disconnect alerts
 * - Room invitations (future)
 */

import { Platform, Alert, Linking, PermissionsAndroid } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidStyle } from '@notifee/react-native';
import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';
import { eventTrackingService } from './EventTrackingService';
import { parseDeepLink } from '@/navigation/deepLinkParser';
import { navigationRef } from '@/navigation/navigationRef';

export interface PushNotificationCallbacks {
  onPartnerLeft?: (roomCode: string) => void;
  onFriendRequest?: (fromUid: string, fromDisplayName: string) => void;
  onRoomInvite?: (roomCode: string, fromUid: string, fromDisplayName: string) => void;
  onTokenRefresh?: (token: string) => void;
}

class PushNotificationService {
  private callbacks: PushNotificationCallbacks = {};
  private unsubscribeOnMessage: (() => void) | null = null;
  private unsubscribeOnTokenRefresh: (() => void) | null = null;

  /**
   * Initialize push notifications
   * Call this on app startup
   */
  async initialize(callbacks: PushNotificationCallbacks = {}): Promise<boolean> {
    this.callbacks = callbacks;

    try {
      // Request permission
      const enabled = await this.requestPermission();

      if (!enabled) {
        console.log('[Push] Permission denied — registering token anyway for silent data messages');
        // On Android, we can still get a token and receive data-only messages
        // even without notification permission. Register the token so we can
        // at least track the device. We'll prompt for permission later.
      } else {
        console.log('[Push] Permission granted');
      }

      // Create Android notification channel (required for Android 8+)
      if (Platform.OS === 'android') {
        await notifee.createChannel({
          id: 'duet_notifications',
          name: 'Duet Notifications',
          importance: AndroidImportance.HIGH,
          sound: 'default',
        });
        console.log('[Push] Android notification channel created');
      }

      // Register for remote messages (required on iOS before getToken)
      if (!messaging().isDeviceRegisteredForRemoteMessages) {
        await messaging().registerDeviceForRemoteMessages();
      }

      // Get and register token
      await this.registerToken();

      // Set up listeners
      this.setupListeners();

      return true;
    } catch (error) {
      console.error('[Push] Initialization error:', error);
      return false;
    }
  }

  /**
   * Request notification permission (handles both iOS and Android 13+)
   */
  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      return (
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL
      );
    }

    // Android 13+ (API 33) requires POST_NOTIFICATIONS runtime permission
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      console.log('[Push] Android POST_NOTIFICATIONS result:', result);
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }

    // Android < 13: notifications are enabled by default
    return true;
  }

  /**
   * Check and request notification permission, prompting the user to
   * open Settings if they previously denied. Returns true if granted.
   */
  async ensurePermission(): Promise<boolean> {
    const alreadyEnabled = await this.areNotificationsEnabled();
    if (alreadyEnabled) return true;

    if (Platform.OS === 'ios') {
      // iOS: once denied, requestPermission() is a no-op. Must go to Settings.
      const authStatus = await messaging().requestPermission();
      const granted =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      if (!granted) {
        this.promptOpenSettings();
        return false;
      }
      return true;
    }

    // Android 13+
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      }
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        this.promptOpenSettings();
      }
      return false;
    }

    // Android < 13: check if channel/app notifications are disabled
    const enabled = await this.areNotificationsEnabled();
    if (!enabled) {
      this.promptOpenSettings();
      return false;
    }
    return true;
  }

  private promptOpenSettings(): void {
    Alert.alert(
      'Notifications Disabled',
      'Push notifications are turned off in your device settings. Would you like to open Settings to enable them?',
      [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
  }

  /**
   * Register the push token with Firebase
   */
  private async registerToken(): Promise<void> {
    try {
      const token = await messaging().getToken();
      console.log('[Push] Token:', token.substring(0, 20) + '...');

      // Save to database for Cloud Functions to use
      await this.saveTokenToDatabase(token);

      this.callbacks.onTokenRefresh?.(token);
    } catch (error) {
      console.error('[Push] Failed to get token:', error);
    }
  }

  /**
   * Save push token to Firebase Realtime Database
   */
  private async saveTokenToDatabase(token: string): Promise<void> {
    const user = auth().currentUser;
    if (!user) {
      console.warn('[Push] No authenticated user, skipping token save');
      return;
    }

    await database().ref(`/users/${user.uid}`).update({
      pushToken: token,
      platform: Platform.OS,
      updatedAt: database.ServerValue.TIMESTAMP,
    });
    console.log('[Push] Token saved to database');
  }

  /**
   * Set up notification listeners
   */
  private setupListeners(): void {
    // Handle foreground messages
    this.unsubscribeOnMessage = messaging().onMessage(
      async (message: FirebaseMessagingTypes.RemoteMessage) => {
        console.log('[Push] Foreground message:', message.data?.type || 'notification-only');

        if (message.data?.type) {
          // App-specific message (partner_left, friend_request, etc.)
          this.handleMessage(message, true);
        } else if (message.notification) {
          // Campaign/generic notification — display via notifee since FCM
          // doesn't auto-show notifications when app is in foreground
          const imageUrl = message.notification.android?.imageUrl || message.data?.imageUrl;
          await notifee.displayNotification({
            title: message.notification.title,
            body: message.notification.body,
            data: message.data,
            android: {
              channelId: 'duet_notifications',
              pressAction: { id: 'default' },
              ...(imageUrl ? {
                largeIcon: imageUrl as string,
                style: { type: AndroidStyle.BIGPICTURE, picture: imageUrl as string },
              } : {}),
            },
          });
        }
      }
    );

    // Handle token refresh
    this.unsubscribeOnTokenRefresh = messaging().onTokenRefresh(async (token) => {
      console.log('[Push] Token refreshed');
      await this.saveTokenToDatabase(token);
      this.callbacks.onTokenRefresh?.(token);
    });

    // Handle background messages (this is called by the background handler)
    messaging().setBackgroundMessageHandler(async (message) => {
      console.log('[Push] Background message:', message.data?.type);
      // Background handling is minimal - just log
      // The notification will show automatically
    });

    // Handle notification opens (when user taps notification)
    messaging().onNotificationOpenedApp((message) => {
      console.log('[Push] Notification opened app:', message.data?.type);
      eventTrackingService.track('push_opened', {
        type: (message.data?.type as string) || 'notification',
      });
      this.handleMessage(message, false);
    });

    // Check if app was opened from notification
    messaging()
      .getInitialNotification()
      .then((message) => {
        if (message) {
          console.log('[Push] App opened from notification:', message.data?.type);
          eventTrackingService.track('push_opened', {
            type: (message.data?.type as string) || 'notification',
          });
          this.handleMessage(message, false);
        }
      });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(
    message: FirebaseMessagingTypes.RemoteMessage,
    isForeground: boolean
  ): void {
    const { data } = message;

    switch (data?.type) {
      case 'partner_left':
        if (isForeground) {
          Alert.alert(
            'Partner Disconnected',
            'Your duet partner has left the room.',
            [{ text: 'OK' }]
          );
        }
        this.callbacks.onPartnerLeft?.(data.roomCode as string);
        break;

      case 'friend_request':
        if (isForeground) {
          Alert.alert(
            'Friend Request',
            `${data.fromDisplayName || 'Someone'} wants to be your friend!`,
            [{ text: 'OK' }]
          );
        }
        this.callbacks.onFriendRequest?.(
          data.fromUid as string,
          data.fromDisplayName as string
        );
        break;

      case 'room_invite':
        if (isForeground) {
          Alert.alert(
            'Room Invitation',
            `${data.fromDisplayName || 'Someone'} invited you to join their room!`,
            [
              { text: 'Decline', style: 'cancel' },
              {
                text: 'Join',
                onPress: () => {
                  this.callbacks.onRoomInvite?.(
                    data.roomCode as string,
                    data.fromUid as string,
                    data.fromDisplayName as string
                  );
                },
              },
            ]
          );
        } else {
          // Tapped notification — auto-join
          this.callbacks.onRoomInvite?.(
            data.roomCode as string,
            data.fromUid as string,
            data.fromDisplayName as string
          );
        }
        break;

      default:
        // Campaign/journey notification with optional action URL
        if (data?.actionUrl) {
          const url = data.actionUrl as string;
          const action = parseDeepLink(url);
          if (!action) break;
          if ('type' in action && action.type === 'external') {
            Linking.openURL(action.url);
          } else if ('screen' in action && navigationRef.isReady()) {
            navigationRef.navigate(action.screen as any, action.params as any);
          }
        }
        break;
    }
  }

  /**
   * Clean up listeners
   */
  cleanup(): void {
    this.unsubscribeOnMessage?.();
    this.unsubscribeOnTokenRefresh?.();
    this.unsubscribeOnMessage = null;
    this.unsubscribeOnTokenRefresh = null;
  }

  /**
   * Remove push token (call when user logs out)
   */
  async removeToken(): Promise<void> {
    try {
      const user = auth().currentUser;
      if (user) {
        await database().ref(`/users/${user.uid}/pushToken`).remove();
      }
      await messaging().deleteToken();
      console.log('[Push] Token removed');
    } catch (error) {
      console.error('[Push] Failed to remove token:', error);
    }
  }

  /**
   * Check if notifications are enabled
   */
  async areNotificationsEnabled(): Promise<boolean> {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const result = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      return result;
    }
    const authStatus = await messaging().hasPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  }

  /**
   * Get the current push token
   */
  async getToken(): Promise<string | null> {
    try {
      return await messaging().getToken();
    } catch {
      return null;
    }
  }
}

// Export singleton
export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
