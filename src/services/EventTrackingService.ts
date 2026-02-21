import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';

export type TrackableEvent =
  | 'push_received'
  | 'push_opened'
  | 'email_sent'
  | 'room_created'
  | 'room_joined'
  | 'login'
  | 'signup'
  | 'profile_updated'
  | 'ad_viewed'
  | 'session_start';

class EventTrackingService {
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
}

export const eventTrackingService = new EventTrackingService();
export default eventTrackingService;
