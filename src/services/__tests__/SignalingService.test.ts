import { SignalingService, SignalingCallbacks } from '../SignalingService';

// Access the shared auth state from jest.setup.js
declare const global: { __mockAuthState: { currentUser: any } };
const mockAuthState = global.__mockAuthState;

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
    mockAuthState.currentUser = null;
    callbacks = createMockCallbacks();
    service = new SignalingService(callbacks);
  });

  describe('generateRoomCode', () => {
    it('produces a 6-character string', () => {
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
      await expect(service.initialize()).rejects.toThrow(
        'Not authenticated. User must sign in before initializing signaling.'
      );
      expect(callbacks.onError).toHaveBeenCalled();
    });

    it('returns the user ID when authenticated', async () => {
      mockAuthState.currentUser = { uid: 'test-user-123' };

      const userId = await service.initialize();
      expect(userId).toBe('test-user-123');
    });
  });

  describe('joinRoom', () => {
    it('throws for non-existent room', async () => {
      // Authenticate first
      mockAuthState.currentUser = { uid: 'test-user-123' };
      await service.initialize();

      // The default database mock returns exists() => false
      await expect(service.joinRoom('ABCDEF')).rejects.toThrow('Room not found');
    });

    it('throws when not authenticated', async () => {
      await expect(service.joinRoom('ABCDEF')).rejects.toThrow(
        'Not authenticated. Call initialize() first.'
      );
    });
  });
});
