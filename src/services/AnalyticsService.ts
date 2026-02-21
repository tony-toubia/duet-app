import analytics from '@react-native-firebase/analytics';

class AnalyticsService {
  /** Log a custom event */
  async logEvent(name: string, params?: Record<string, string | number>) {
    try {
      await analytics().logEvent(name, params);
    } catch {
      // Swallow — analytics should never break the app
    }
  }

  /** Track screen views */
  async logScreenView(screenName: string) {
    try {
      await analytics().logScreenView({ screen_name: screenName, screen_class: screenName });
    } catch {}
  }

  /** Auth */
  async logSignUp(method: string) {
    await this.logEvent('sign_up', { method });
  }

  async logLogin(method: string) {
    await this.logEvent('login', { method });
  }

  /** Room lifecycle */
  async logRoomCreated() {
    await this.logEvent('room_created');
  }

  async logRoomJoined() {
    await this.logEvent('room_joined');
  }

  async logRoomLeft(durationSec: number) {
    await this.logEvent('room_left', { duration_sec: Math.round(durationSec) });
  }

  /** Social */
  async logFriendAdded() {
    await this.logEvent('friend_added');
  }

  async logInviteSent() {
    await this.logEvent('invite_sent');
  }

  /** Set user ID for analytics */
  async setUserId(uid: string | null) {
    try {
      await analytics().setUserId(uid);
    } catch {}
  }
}

export const analyticsService = new AnalyticsService();
