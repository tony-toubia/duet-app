/**
 * Crashlytics Service (Web)
 *
 * Reports errors and events to Firebase Analytics (Crashlytics has no web SDK).
 * Falls back to console logging if analytics isn't available.
 */
import { logEvent } from 'firebase/analytics';
import { getFirebaseAnalytics } from './firebase';

class CrashlyticsService {
  async initialize(): Promise<void> {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (e) => {
        this.recordError(e.error || new Error(e.message), 'uncaught_error');
      });
      window.addEventListener('unhandledrejection', (e) => {
        const error = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
        this.recordError(error, 'unhandled_rejection');
      });
    }
    console.log('[Crashlytics] Web service initialized');
  }

  private logToAnalytics(name: string, params?: Record<string, string | number>) {
    try {
      const analytics = getFirebaseAnalytics();
      if (analytics) logEvent(analytics, name, params);
    } catch {}
  }

  log(message: string): void {
    console.log(message);
  }

  recordError(error: Error, context?: string): void {
    console.error('[Crashlytics]', context || '', error.message);
    this.logToAnalytics('app_error', {
      error_message: error.message.slice(0, 100),
      error_context: context || 'unknown',
    });
  }

  async setAttribute(_key: string, _value: string): Promise<void> {}
  async setAttributes(_attributes: Record<string, string>): Promise<void> {}
  async setUser(_user: { odId: string }): Promise<void> {}
  async clearUser(): Promise<void> {}
  async setEnabled(_enabled: boolean): Promise<void> {}

  logAudioSetup(platform: string, sampleRate: number): void {
    this.log(`[Audio] Setup: platform=${platform}, sampleRate=${sampleRate}`);
  }

  logAudioEngineStart(): void {
    this.log('[Audio] Engine started');
  }

  logAudioEngineStop(): void {
    this.log('[Audio] Engine stopped');
  }

  logAudioError(error: Error, operation: string): void {
    console.error(`[Audio] Error during ${operation}:`, error.message);
    this.logToAnalytics('audio_error', { operation, error_message: error.message.slice(0, 100) });
  }

  logWebRTCStateChange(state: string): void {
    this.log(`[WebRTC] State: ${state}`);
  }

  logWebRTCError(error: Error, operation: string): void {
    console.error(`[WebRTC] Error during ${operation}:`, error.message);
    this.logToAnalytics('webrtc_error', { operation, error_message: error.message.slice(0, 100) });
  }

  logRoomCreated(roomCode: string): void {
    this.log(`[Room] Created: ${roomCode}`);
    this.logToAnalytics('room_created');
  }

  logRoomJoined(roomCode: string): void {
    this.log(`[Room] Joined: ${roomCode}`);
    this.logToAnalytics('room_joined');
  }

  logRoomLeft(): void {
    this.log('[Room] Left');
    this.logToAnalytics('room_left');
  }
}

export const crashlyticsService = new CrashlyticsService();
