/**
 * Join/rejoin behaviour for duet rooms, driven against an in-memory RTDB so
 * two clients can be run against the same shared state.
 */
import type { FakeRtdb } from './helpers/fakeRtdb';

// The factory is hoisted above the imports, so it owns the instance and
// publishes it on globalThis for the test body to reach.
jest.mock('@react-native-firebase/database', () => {
  const { FakeRtdb: Fake, createDatabaseMock } = require('./helpers/fakeRtdb');
  const db = new Fake();
  (globalThis as any).__fakeDb = db;
  return createDatabaseMock(db);
});

import { SignalingService, SignalingCallbacks } from '../SignalingService';

const mockDb = (globalThis as any).__fakeDb as FakeRtdb;

const mockAuthState = (global as any).__mockAuthState as { currentUser: any };

function callbacks(): jest.Mocked<SignalingCallbacks> {
  return {
    onOffer: jest.fn(),
    onAnswer: jest.fn(),
    onIceCandidate: jest.fn(),
    onPartnerJoined: jest.fn(),
    onPartnerLeft: jest.fn(),
    onRoomDeleted: jest.fn(),
    onError: jest.fn(),
  } as any;
}

/** Services created during a test, torn down afterwards so the heartbeat
 *  interval and RTDB listeners don't leak between (or outlive) tests. */
const activeServices: SignalingService[] = [];

async function makeService(uid: string) {
  mockAuthState.currentUser = { uid };
  const cbs = callbacks();
  const service = new SignalingService(cbs);
  await service.initialize();
  activeServices.push(service);
  return { service, cbs };
}

/** Seed a room as if another user had created it and is still present. */
function seedRoom(code: string, hostUid: string, extra: Record<string, any> = {}) {
  mockDb.setRaw(`rooms/${code}`, {
    createdAt: Date.now(),
    createdBy: hostUid,
    members: { [hostUid]: { role: 'offerer', joinedAt: Date.now() } },
    ...extra,
  });
}

describe('SignalingService join behaviour', () => {
  beforeEach(() => {
    // Fake timers for the whole suite: the debounce/heartbeat timers are armed
    // during setup, so they must already be faked before any service runs.
    jest.useFakeTimers();
    mockDb.setRaw('', {});
    mockDb.writeLog.length = 0;
    mockAuthState.currentUser = null;
    jest.clearAllMocks();
  });

  afterEach(async () => {
    for (const service of activeServices.splice(0)) {
      try {
        await service.leave();
      } catch {
        // already left
      }
    }
    jest.useRealTimers();
  });

  describe('createRoom', () => {
    it('registers the creator as a member and arms onDisconnect', async () => {
      const { service } = await makeService('host-1');
      const code = await service.createRoom();

      const room = mockDb.getRaw(`rooms/${code}`);
      expect(room.createdBy).toBe('host-1');
      expect(room.members['host-1'].role).toBe('offerer');
      expect(mockDb.hasOnDisconnect(`rooms/${code}/members/host-1`)).toBe(true);
    });
  });

  describe('joinRoom guards', () => {
    it('rejects a room that does not exist', async () => {
      const { service } = await makeService('guest-1');
      await expect(service.joinRoom('NOPE12')).rejects.toThrow('Room not found');
    });

    it('rejects an abandoned room whose host is gone', async () => {
      // Host crashed: onDisconnect removed the member but the room shell remains
      mockDb.setRaw('rooms/ABC123', {
        createdAt: Date.now(),
        createdBy: 'host-1',
      });

      const { service } = await makeService('guest-1');
      await expect(service.joinRoom('ABC123')).rejects.toThrow('no longer active');
    });

    it('rejects a third participant in a two-person room', async () => {
      seedRoom('ABC123', 'host-1', {
        members: {
          'host-1': { role: 'offerer', joinedAt: Date.now() },
          'guest-1': { role: 'answerer', joinedAt: Date.now() },
        },
      });

      const { service } = await makeService('guest-2');
      await expect(service.joinRoom('ABC123')).rejects.toThrow('full');

      // The rejected user must not have been written into members
      expect(mockDb.getRaw('rooms/ABC123/members/guest-2')).toBeNull();
    });

    it('admits a normal second participant', async () => {
      seedRoom('ABC123', 'host-1');

      const { service } = await makeService('guest-1');
      const result = await service.joinRoom('ABC123');

      expect(result.isRejoin).toBe(false);
      expect(mockDb.getRaw('rooms/ABC123/members/guest-1').role).toBe('answerer');
    });
  });

  describe('rejoin after a crash or network drop', () => {
    it('admits the same uid instead of locking them out', async () => {
      // Our previous session's member entry is still present because
      // onDisconnect has not fired yet (or the heartbeat recreated it).
      seedRoom('ABC123', 'host-1', {
        members: {
          'host-1': { role: 'offerer', joinedAt: Date.now() },
          'guest-1': { role: 'answerer', joinedAt: Date.now() },
        },
      });

      const { service } = await makeService('guest-1');
      const result = await service.joinRoom('ABC123');

      expect(result.isRejoin).toBe(true);
      expect(mockDb.getRaw('rooms/ABC123/members/guest-1')).not.toBeNull();
    });

    it('signals a rejoin even when we are the only member left', async () => {
      // Both dropped; ours is the stale entry that survived
      mockDb.setRaw('rooms/ABC123', {
        createdAt: Date.now(),
        createdBy: 'host-1',
        members: { 'guest-1': { role: 'answerer', joinedAt: Date.now() } },
      });

      const { service } = await makeService('guest-1');
      const result = await service.joinRoom('ABC123');

      // Not treated as "abandoned" — it's our own entry, so we may return
      expect(result.isRejoin).toBe(true);
    });
  });

  describe('stale signaling cleanup', () => {
    it('clears the previous session offer/answer/candidates before joining', async () => {
      seedRoom('ABC123', 'host-1', {
        members: { 'host-1': { role: 'offerer', joinedAt: Date.now() } },
        offer: { type: 'offer', sdp: 'STALE_SDP', sentBy: 'host-1' },
        answer: { type: 'answer', sdp: 'STALE_ANSWER', sentBy: 'old-guest' },
        offerCandidates: { c1: { candidate: 'stale', sdpMid: '0', sdpMLineIndex: 0 } },
        answerCandidates: { c2: { candidate: 'stale', sdpMid: '0', sdpMLineIndex: 0 } },
      });

      const { service, cbs } = await makeService('guest-1');
      await service.joinRoom('ABC123');

      expect(mockDb.getRaw('rooms/ABC123/offer')).toBeNull();
      expect(mockDb.getRaw('rooms/ABC123/answer')).toBeNull();
      expect(mockDb.getRaw('rooms/ABC123/offerCandidates')).toBeNull();
      expect(mockDb.getRaw('rooms/ABC123/answerCandidates')).toBeNull();

      // and the stale offer must never have reached the peer connection
      expect(cbs.onOffer).not.toHaveBeenCalled();
    });

    it('clears signaling before registering as a member', async () => {
      seedRoom('ABC123', 'host-1', {
        members: { 'host-1': { role: 'offerer', joinedAt: Date.now() } },
        offer: { type: 'offer', sdp: 'STALE', sentBy: 'host-1' },
      });

      const { service } = await makeService('guest-1');
      await service.joinRoom('ABC123');

      // Ordering matters: if we registered first, the host would generate a new
      // offer that our cleanup could then delete, stalling the handshake.
      const clearedAt = mockDb.writeLog.indexOf('rooms/ABC123/offer');
      const joinedAt = mockDb.writeLog.indexOf('rooms/ABC123/members/guest-1');
      expect(clearedAt).toBeGreaterThanOrEqual(0);
      expect(joinedAt).toBeGreaterThan(clearedAt);
    });
  });

  describe('partner presence', () => {
    it('notifies the host when a guest joins', async () => {
      const { service: host, cbs: hostCbs } = await makeService('host-1');
      const code = await host.createRoom();

      const { service: guest } = await makeService('guest-1');
      await guest.joinRoom(code);

      expect(hostCbs.onPartnerJoined).toHaveBeenCalled();
    });

    it('does not report a partner as left until the debounce elapses', async () => {
      const { service: host, cbs: hostCbs } = await makeService('host-1');
      const code = await host.createRoom();

      const { service: guest } = await makeService('guest-1');
      await guest.joinRoom(code);
      expect(hostCbs.onPartnerJoined).toHaveBeenCalled();

      // Guest departs for real: its listeners and heartbeat stop too
      await guest.leave();

      expect(hostCbs.onPartnerLeft).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(14_000);
      expect(hostCbs.onPartnerLeft).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(2_000);
      expect(hostCbs.onPartnerLeft).toHaveBeenCalled();
    });

    it('does not let our own heartbeat keep resetting the countdown', async () => {
      // Regression: the heartbeat rewrites members/{uid} every 10s, which
      // re-fires this listener. Restarting the 15s debounce on every such
      // write meant onPartnerLeft could never fire at all.
      const { service: host, cbs: hostCbs } = await makeService('host-1');
      const code = await host.createRoom();

      const { service: guest } = await makeService('guest-1');
      await guest.joinRoom(code);
      await guest.leave();

      // Well past several heartbeat cycles
      await jest.advanceTimersByTimeAsync(60_000);
      expect(hostCbs.onPartnerLeft).toHaveBeenCalledTimes(1);
    });

    it('cancels the pending "left" when the partner returns in time', async () => {
      const { service: host, cbs: hostCbs } = await makeService('host-1');
      const code = await host.createRoom();

      const { service: guest } = await makeService('guest-1');
      await guest.joinRoom(code);

      // Partner's entry vanishes (onDisconnect fired during a background blip)
      mockDb.setRaw(`rooms/${code}/members/guest-1`, null);
      await jest.advanceTimersByTimeAsync(5_000);

      // ...and comes back well inside the debounce window
      mockDb.setRaw(`rooms/${code}/members/guest-1`, {
        role: 'answerer',
        joinedAt: Date.now(),
      });
      await jest.advanceTimersByTimeAsync(30_000);

      expect(hostCbs.onPartnerLeft).not.toHaveBeenCalled();
    });

    it('restores our own member entry via heartbeat if onDisconnect drops it', async () => {
      // A backgrounded-but-alive client can have its entry removed server-side;
      // the heartbeat must write a complete, rules-valid record to restore it.
      const { service: host } = await makeService('host-1');
      const code = await host.createRoom();

      mockDb.setRaw(`rooms/${code}/members/host-1`, null);

      await jest.advanceTimersByTimeAsync(11_000);

      const restored = mockDb.getRaw(`rooms/${code}/members/host-1`);
      expect(restored).not.toBeNull();
      // Must satisfy the security rules' required children
      expect(restored.role).toBe('offerer');
      expect(typeof restored.joinedAt).toBe('number');
    });
  });

  describe('leave', () => {
    it('removes the host and deletes the room', async () => {
      const { service } = await makeService('host-1');
      const code = await service.createRoom();

      await service.leave();

      expect(mockDb.getRaw(`rooms/${code}`)).toBeNull();
    });

    it('removes a guest without deleting the room', async () => {
      const { service: host } = await makeService('host-1');
      const code = await host.createRoom();

      const { service: guest } = await makeService('guest-1');
      await guest.joinRoom(code);
      await guest.leave();

      expect(mockDb.getRaw(`rooms/${code}`)).not.toBeNull();
      expect(mockDb.getRaw(`rooms/${code}/members/guest-1`)).toBeNull();
      expect(mockDb.getRaw(`rooms/${code}/members/host-1`)).not.toBeNull();
    });
  });
});
