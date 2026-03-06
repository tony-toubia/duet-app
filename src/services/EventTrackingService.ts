import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';

export type TrackableEvent =
  | 'push_received'
  | 'push_opened'
  | 'email_sent'
  | 'room_created'
  | 'room_joined'
  | 'room_left'
  | 'login'
  | 'signup'
  | 'profile_updated'
  | 'ad_viewed'
  | 'ad_rewarded'
  | 'session_start'
  | 'session_duration'
  | 'connection_established'
  | 'connection_failed'
  | 'friend_request_sent'
  | 'friend_request_accepted'
  | 'invitation_sent'
  | 'guest_upgrade'
  | 'onboarding_completed'
  | 'referral_sent';

class EventTrackingService {
  private sessionStartTime: number | null = null;

  /**
   * Log an event for the current user.
   * Writes to: events/{userId}/{eventType}/{pushId}
   */
  async track(
    eventType: TrackableEvent,
    metadata?: Record<string, string>
  ): Promise<void> {
    try {
      const user = auth().currentUser;
      if (!user) return;

      const entry: any = {
        type: eventType,
        timestamp: database.ServerValue.TIMESTAMP,
      };
      if (metadata) entry.metadata = metadata;

      await database()
        .ref(`events/${user.uid}/${eventType}`)
        .push(entry);
    } catch (error) {
      // Don't let tracking errors crash the app
      console.warn('[EventTracking] Failed to track event:', eventType, error);
    }
  }

  /**
   * Start tracking a room session duration.
   */
  startSession(): void {
    this.sessionStartTime = Date.now();
  }

  /**
   * End session tracking and log the duration.
   */
  async endSession(metadata?: Record<string, string>): Promise<void> {
    if (!this.sessionStartTime) return;
    const durationMs = Date.now() - this.sessionStartTime;
    const durationSec = Math.round(durationMs / 1000);
    this.sessionStartTime = null;
    await this.track('session_duration', {
      ...metadata,
      durationSeconds: String(durationSec),
    });
  }
}

export const eventTrackingService = new EventTrackingService();
export default eventTrackingService;
