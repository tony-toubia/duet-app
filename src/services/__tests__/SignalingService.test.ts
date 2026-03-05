import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import { SignalingService, SignalingCallbacks } from '../SignalingService';

// Helper to create a mock callbacks object
function createMockCallbacks(): SignalingCallbacks {
  return {
    onOffer: jest.fn(),
    onAnswer: jest.fn(),
    onIceCandidate: jest.fn(),
    onPartnerJoined: jest.fn(),
    onPartnerLeft: jest.fn(),
    onRoomDeleted: jest.fn(),
    onError: jest.fn(),
  };
}

describe('SignalingService', () => {
  let service: SignalingService;
  let callbacks: SignalingCallbacks;

  beforeEach(() => {
    jest.clearAllMocks();
    callbacks = createMockCallbacks();
    service = new SignalingService(callbacks);
  });

  describe('generateRoomCode', () => {
    it('produces a 6-character string', () => {
      // generateRoomCode is private, so we test it indirectly via createRoom
      // or access it through bracket notation for testing purposes
      const code = (service as any).generateRoomCode();
      expect(typeof code).toBe('string');
      expect(code).toHaveLength(6);
    });

    it('produces only uppercase letters and digits (excluding confusing chars)', () => {
      const allowedChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      for (let i = 0; i < 50; i++) {
        const code = (service as any).generateRoomCode();
        for (const char of code) {
          expect(allowedChars).toContain(char);
        }
      }
    });
  });

  describe('initialize', () => {
    it('throws when no user is authenticated', async () => {
      // The default mock returns currentUser: null
      await expect(service.initialize()).rejects.toThrow(
        'Not authenticated. User must sign in before initializing signaling.'
      );
      expect(callbacks.onError).toHaveBeenCalled();
    });

    it('returns the user ID when authenticated', async () => {
      // Override the auth mock to return a currentUser
      (auth as unknown as jest.Mock).mockReturnValueOnce({
        currentUser: { uid: 'test-user-123' },
        onAuthStateChanged: jest.fn(),
      });

      const userId = await service.initialize();
      expect(userId).toBe('test-user-123');
    });
  });

  describe('joinRoom', () => {
    it('throws for non-existent room', async () => {
      // First authenticate the service
      (auth as unknown as jest.Mock).mockReturnValueOnce({
        currentUser: { uid: 'test-user-123' },
        onAuthStateChanged: jest.fn(),
      });
      await service.initialize();

      // The default database mock returns exists() => false
      await expect(service.joinRoom('ABCDEF')).rejects.toThrow('Room not found');
    });

    it('throws when not authenticated', async () => {
      // Don't call initialize, so userId is null
      await expect(service.joinRoom('ABCDEF')).rejects.toThrow(
        'Not authenticated. Call initialize() first.'
      );
    });
  });
});
