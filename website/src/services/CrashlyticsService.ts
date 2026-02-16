/**
 * Crashlytics Service (Web Stub)
 *
 * Uses console logging instead of Firebase Crashlytics.
 * Can be replaced with a real web error tracking service later.
 */

class CrashlyticsService {
  async initialize(): Promise<void> {
    console.log('[Crashlytics] Web stub initialized');
  }

  log(message: string): void {
    console.log(message);
  }

  recordError(error: Error, context?: string): void {
    console.error('[Crashlytics]', context || '', error.message);
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
  }

  logWebRTCStateChange(state: string): void {
    this.log(`[WebRTC] State: ${state}`);
  }

  logWebRTCError(error: Error, operation: string): void {
    console.error(`[WebRTC] Error during ${operation}:`, error.message);
  }

  logRoomCreated(roomCode: string): void {
    this.log(`[Room] Created: ${roomCode}`);
  }

  logRoomJoined(roomCode: string): void {
    this.log(`[Room] Joined: ${roomCode}`);
  }

  logRoomLeft(): void {
    this.log('[Room] Left');
  }
}

export const crashlyticsService = new CrashlyticsService();
