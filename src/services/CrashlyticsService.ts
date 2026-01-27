/**
 * Crashlytics Service
 *
 * Handles crash reporting and error logging for:
 * - Native module crashes
 * - JavaScript exceptions
 * - Audio/WebRTC errors
 * - Custom event logging
 */

import crashlytics from '@react-native-firebase/crashlytics';

export interface UserInfo {
  odId: string;
  isHost?: boolean;
  roomCode?: string;
}

class CrashlyticsService {
  private isEnabled: boolean = true;

  /**
   * Initialize Crashlytics
   * Call this on app startup
   */
  async initialize(): Promise<void> {
    try {
      // Enable collection (can be toggled for user privacy preferences)
      await crashlytics().setCrashlyticsCollectionEnabled(this.isEnabled);
      console.log('[Crashlytics] Initialized');
    } catch (error) {
      console.error('[Crashlytics] Initialization error:', error);
    }
  }

  /**
   * Set user information for crash reports
   */
  async setUser(user: UserInfo): Promise<void> {
    try {
      await crashlytics().setUserId(user.odId);

      if (user.isHost !== undefined) {
        await crashlytics().setAttribute('isHost', String(user.isHost));
      }

      if (user.roomCode) {
        await crashlytics().setAttribute('roomCode', user.roomCode);
      }

      console.log('[Crashlytics] User set:', user.odId);
    } catch (error) {
      console.error('[Crashlytics] Failed to set user:', error);
    }
  }

  /**
   * Clear user information
   */
  async clearUser(): Promise<void> {
    try {
      await crashlytics().setUserId('');
      await crashlytics().setAttributes({
        isHost: '',
        roomCode: '',
      });
    } catch (error) {
      console.error('[Crashlytics] Failed to clear user:', error);
    }
  }

  /**
   * Log a custom event/breadcrumb
   * Use this to track important user actions
   */
  log(message: string): void {
    try {
      crashlytics().log(message);
    } catch (error) {
      console.error('[Crashlytics] Failed to log:', error);
    }
  }

  /**
   * Record a non-fatal error
   * Use this for errors that are caught but worth tracking
   */
  recordError(error: Error, context?: string): void {
    try {
      if (context) {
        crashlytics().log(`Context: ${context}`);
      }
      crashlytics().recordError(error);
      console.log('[Crashlytics] Error recorded:', error.message);
    } catch (err) {
      console.error('[Crashlytics] Failed to record error:', err);
    }
  }

  /**
   * Set custom key-value attributes
   */
  async setAttribute(key: string, value: string): Promise<void> {
    try {
      await crashlytics().setAttribute(key, value);
    } catch (error) {
      console.error('[Crashlytics] Failed to set attribute:', error);
    }
  }

  /**
   * Set multiple attributes at once
   */
  async setAttributes(attributes: Record<string, string>): Promise<void> {
    try {
      await crashlytics().setAttributes(attributes);
    } catch (error) {
      console.error('[Crashlytics] Failed to set attributes:', error);
    }
  }

  /**
   * Force a test crash (for testing only!)
   */
  testCrash(): void {
    crashlytics().crash();
  }

  /**
   * Enable/disable crash collection
   * Useful for user privacy preferences
   */
  async setEnabled(enabled: boolean): Promise<void> {
    this.isEnabled = enabled;
    await crashlytics().setCrashlyticsCollectionEnabled(enabled);
  }

  // =====================
  // AUDIO-SPECIFIC LOGGING
  // =====================

  /**
   * Log audio session setup
   */
  logAudioSetup(platform: string, sampleRate: number): void {
    this.log(`[Audio] Setup: platform=${platform}, sampleRate=${sampleRate}`);
    this.setAttributes({
      audioPlatform: platform,
      audioSampleRate: String(sampleRate),
    });
  }

  /**
   * Log audio engine start
   */
  logAudioEngineStart(): void {
    this.log('[Audio] Engine started');
  }

  /**
   * Log audio engine stop
   */
  logAudioEngineStop(): void {
    this.log('[Audio] Engine stopped');
  }

  /**
   * Log audio error
   */
  logAudioError(error: Error, operation: string): void {
    this.log(`[Audio] Error during ${operation}: ${error.message}`);
    this.recordError(error, `Audio: ${operation}`);
  }

  // =====================
  // WEBRTC-SPECIFIC LOGGING
  // =====================

  /**
   * Log WebRTC connection state change
   */
  logWebRTCStateChange(state: string): void {
    this.log(`[WebRTC] State: ${state}`);
    this.setAttribute('webrtcState', state);
  }

  /**
   * Log WebRTC error
   */
  logWebRTCError(error: Error, operation: string): void {
    this.log(`[WebRTC] Error during ${operation}: ${error.message}`);
    this.recordError(error, `WebRTC: ${operation}`);
  }

  /**
   * Log ICE connection failure
   */
  logICEFailure(candidateType: string): void {
    this.log(`[WebRTC] ICE failed: ${candidateType}`);
    this.setAttribute('lastICEFailure', candidateType);
  }

  // =====================
  // ROOM-SPECIFIC LOGGING
  // =====================

  /**
   * Log room creation
   */
  logRoomCreated(roomCode: string): void {
    this.log(`[Room] Created: ${roomCode}`);
    this.setAttribute('roomCode', roomCode);
  }

  /**
   * Log room join
   */
  logRoomJoined(roomCode: string): void {
    this.log(`[Room] Joined: ${roomCode}`);
    this.setAttribute('roomCode', roomCode);
  }

  /**
   * Log room leave
   */
  logRoomLeft(): void {
    this.log('[Room] Left');
    this.setAttribute('roomCode', '');
  }
}

// Export singleton
export const crashlyticsService = new CrashlyticsService();
export default crashlyticsService;
