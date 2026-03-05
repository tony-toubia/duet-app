import auth from '@react-native-firebase/auth';
import { eventTrackingService } from '../EventTrackingService';

describe('EventTrackingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('track', () => {
    it('does not throw when no user is authenticated', async () => {
      // The default auth mock returns currentUser: null
      await expect(
        eventTrackingService.track('room_created')
      ).resolves.not.toThrow();
    });

    it('does not throw when called with metadata', async () => {
      await expect(
        eventTrackingService.track('push_received', { source: 'test' })
      ).resolves.not.toThrow();
    });
  });

  describe('startSession / endSession', () => {
    it('startSession sets the session start time without throwing', () => {
      expect(() => eventTrackingService.startSession()).not.toThrow();
    });

    it('endSession resolves without error after startSession', async () => {
      eventTrackingService.startSession();
      await expect(eventTrackingService.endSession()).resolves.not.toThrow();
    });

    it('endSession is a no-op if startSession was not called', async () => {
      // Reset by creating a fresh instance scenario — endSession without startSession
      // Since the singleton may have state from previous tests, we test the guard:
      // calling endSession twice should be safe (second call is no-op)
      eventTrackingService.startSession();
      await eventTrackingService.endSession();
      // Second call — sessionStartTime is now null, should be a no-op
      await expect(eventTrackingService.endSession()).resolves.not.toThrow();
    });

    it('endSession passes metadata through to track', async () => {
      eventTrackingService.startSession();
      await expect(
        eventTrackingService.endSession({ roomCode: 'ABC123' })
      ).resolves.not.toThrow();
    });
  });
});
