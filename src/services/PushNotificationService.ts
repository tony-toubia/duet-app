/**
 * Push Notification Service
 *
 * Handles registration and handling of push notifications for:
 * - Partner disconnect alerts
 * - Room invitations (future)
 */

import { Platform, Alert, Linking } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidStyle } from '@notifee/react-native';
import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';
import { eventTrackingService } from './EventTrackingService';

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
      // Request permission (required for iOS, no-op on Android)
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('[Push] Permission denied');
        return false;
      }

      console.log('[Push] Permission granted');

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
          if (url.startsWith('http')) {
            Linking.openURL(url);
          } else if (url.startsWith('duet://room/')) {
            const roomCode = url.replace('duet://room/', '');
            this.callbacks.onRoomInvite?.(roomCode, '', '');
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
