/**
 * Push Notification Service
 *
 * Handles registration and handling of push notifications for:
 * - Partner disconnect alerts
 * - Room invitations (future)
 */

import { Platform, Alert } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';

export interface PushNotificationCallbacks {
  onPartnerLeft?: (roomCode: string) => void;
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
    // Get or create anonymous user
    let user = auth().currentUser;
    if (!user) {
      const result = await auth().signInAnonymously();
      user = result.user;
    }

    if (user) {
      await database().ref(`/users/${user.uid}`).update({
        pushToken: token,
        platform: Platform.OS,
        updatedAt: database.ServerValue.TIMESTAMP,
      });
      console.log('[Push] Token saved to database');
    }
  }

  /**
   * Set up notification listeners
   */
  private setupListeners(): void {
    // Handle foreground messages
    this.unsubscribeOnMessage = messaging().onMessage(
      async (message: FirebaseMessagingTypes.RemoteMessage) => {
        console.log('[Push] Foreground message:', message.data?.type);
        this.handleMessage(message, true);
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
      this.handleMessage(message, false);
    });

    // Check if app was opened from notification
    messaging()
      .getInitialNotification()
      .then((message) => {
        if (message) {
          console.log('[Push] App opened from notification:', message.data?.type);
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
          // Show alert when in foreground
          Alert.alert(
            'Partner Disconnected',
            'Your duet partner has left the room.',
            [{ text: 'OK' }]
          );
        }
        this.callbacks.onPartnerLeft?.(data.roomCode);
        break;

      default:
        console.log('[Push] Unknown message type:', data?.type);
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
