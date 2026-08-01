/**
 * Party-mode signaling: pair routing, candidate isolation across the mesh,
 * and join guards. Runs several participants against one shared fake RTDB.
 */
import type { FakeRtdb } from './helpers/fakeRtdb';

jest.mock('@react-native-firebase/database', () => {
  const { FakeRtdb: Fake, createDatabaseMock } = require('./helpers/fakeRtdb');
  const db = new Fake();
  (globalThis as any).__fakeDb = db;
  return createDatabaseMock(db);
});

import { PartySignalingService, PartySignalingCallbacks } from '../PartySignalingService';

const mockDb = (globalThis as any).__fakeDb as FakeRtdb;
const mockAuthState = (globalThis as any).__mockAuthState as { currentUser: any };

function callbacks(): jest.Mocked<PartySignalingCallbacks> {
  return {
    onOffer: jest.fn(),
    onAnswer: jest.fn(),
    onIceCandidate: jest.fn(),
    onParticipantJoined: jest.fn(),
    onParticipantLeft: jest.fn(),
    onRoomDeleted: jest.fn(),
    onError: jest.fn(),
  } as any;
}

const active: PartySignalingService[] = [];

async function makeService(uid: string) {
  mockAuthState.currentUser = { uid };
  const cbs = callbacks();
  const service = new PartySignalingService(cbs);
  await service.initialize();
  active.push(service);
  return { service, cbs };
}

const sdp = (label: string) => ({ type: 'offer', sdp: label }) as any;
const answerSdp = (label: string) => ({ type: 'answer', sdp: label }) as any;
const candidate = (label: string) =>
  ({ candidate: label, sdpMid: '0', sdpMLineIndex: 0 }) as any;

describe('PartySignalingService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockDb.setRaw('', {});
    mockAuthState.currentUser = null;
    jest.clearAllMocks();
  });

  afterEach(async () => {
    for (const service of active.splice(0)) {
      try {
        await service.leave();
      } catch {
        // already left
      }
    }
    jest.useRealTimers();
  });

  describe('offer/answer routing', () => {
    it('completes a handshake: host offers, joiner answers, host receives it', async () => {
      const { service: host, cbs: hostCbs } = await makeService('host-1');
      const code = await host.createRoom();

      const { service: guest, cbs: guestCbs } = await makeService('guest-1');
      const existing = await guest.joinRoom(code);

      // The joiner learns who is already present
      expect(existing).toEqual(['host-1']);
      // ...and the host is told a participant arrived
      expect(hostCbs.onParticipantJoined).toHaveBeenCalledWith('guest-1');

      // Host offers to the newcomer
      await host.sendOffer('guest-1', sdp('OFFER_H2G'));
      expect(guestCbs.onOffer).toHaveBeenCalledWith(
        'host-1',
        expect.objectContaining({ sdp: 'OFFER_H2G' })
      );

      // Joiner answers — the host must receive it, attributed to the joiner.
      // This is the regression: answers written to the answerer's own pair
      // came back to the answerer and never reached the offerer.
      await guest.sendAnswer('host-1', answerSdp('ANSWER_G2H'));

      expect(hostCbs.onAnswer).toHaveBeenCalledWith(
        'guest-1',
        expect.objectContaining({ sdp: 'ANSWER_G2H' })
      );
      expect(guestCbs.onAnswer).not.toHaveBeenCalled();
    });

    it('does not deliver an offer back to the participant who sent it', async () => {
      const { service: host, cbs: hostCbs } = await makeService('host-1');
      const code = await host.createRoom();
      const { service: guest } = await makeService('guest-1');
      await guest.joinRoom(code);

      await host.sendOffer('guest-1', sdp('OFFER_H2G'));

      expect(hostCbs.onOffer).not.toHaveBeenCalled();
    });
  });

  describe('ICE candidate isolation', () => {
    it('delivers a candidate to its addressee', async () => {
      const { service: host } = await makeService('host-1');
      const code = await host.createRoom();
      const { service: guest, cbs: guestCbs } = await makeService('guest-1');
      await guest.joinRoom(code);

      await host.sendIceCandidate('guest-1', candidate('CAND_H2G'));

      expect(guestCbs.onIceCandidate).toHaveBeenCalledWith(
        'host-1',
        expect.objectContaining({ candidate: 'CAND_H2G' })
      );
    });

    it('does not leak candidates exchanged between two other participants', async () => {
      const { service: host } = await makeService('host-1');
      const code = await host.createRoom();
      const { service: guestA } = await makeService('guest-a');
      await guestA.joinRoom(code);
      const { service: guestB, cbs: guestBCbs } = await makeService('guest-b');
      await guestB.joinRoom(code);

      guestBCbs.onIceCandidate.mockClear();

      // Traffic strictly between host and guest-a
      await host.sendIceCandidate('guest-a', candidate('CAND_H2A'));
      await guestA.sendIceCandidate('host-1', candidate('CAND_A2H'));

      const seen = guestBCbs.onIceCandidate.mock.calls.map(
        ([, c]: any[]) => (c as any).candidate
      );
      expect(seen).not.toContain('CAND_H2A');
      expect(seen).not.toContain('CAND_A2H');
    });

    it('delivers each candidate only once despite repeated pair updates', async () => {
      const { service: host } = await makeService('host-1');
      const code = await host.createRoom();
      const { service: guest, cbs: guestCbs } = await makeService('guest-1');
      await guest.joinRoom(code);

      await host.sendIceCandidate('guest-1', candidate('CAND_1'));
      // Each further write to the same pair replays the whole node
      await host.sendIceCandidate('guest-1', candidate('CAND_2'));
      await host.sendIceCandidate('guest-1', candidate('CAND_3'));

      const delivered = guestCbs.onIceCandidate.mock.calls.map(
        ([, c]: any[]) => (c as any).candidate
      );
      expect(delivered).toEqual(['CAND_1', 'CAND_2', 'CAND_3']);
    });
  });

  describe('join guards', () => {
    it('rejects a duet room code', async () => {
      mockDb.setRaw('rooms/DUET01', {
        createdAt: Date.now(),
        createdBy: 'someone',
        members: { someone: { role: 'offerer', joinedAt: Date.now() } },
      });

      const { service } = await makeService('guest-1');
      await expect(service.joinRoom('DUET01')).rejects.toThrow('does not support party mode');
    });

    it('rejects a seventh participant', async () => {
      const members: Record<string, any> = {};
      for (let i = 0; i < 6; i++) {
        members[`user-${i}`] = { role: 'member', joinedAt: Date.now() };
      }
      mockDb.setRaw('rooms/PARTY1', {
        roomType: 'party',
        maxParticipants: 6,
        createdAt: Date.now(),
        createdBy: 'user-0',
        members,
      });

      const { service } = await makeService('guest-7');
      await expect(service.joinRoom('PARTY1')).rejects.toThrow('full');
    });

    it('admits a returning uid whose stale entry survived a crash', async () => {
      mockDb.setRaw('rooms/PARTY1', {
        roomType: 'party',
        maxParticipants: 2,
        createdAt: Date.now(),
        createdBy: 'host-1',
        members: {
          'host-1': { role: 'host', joinedAt: Date.now() },
          'guest-1': { role: 'member', joinedAt: Date.now() },
        },
      });

      // Room is at capacity, but one of those entries is our own stale record
      const { service } = await makeService('guest-1');
      const existing = await service.joinRoom('PARTY1');

      expect(existing).toEqual(['host-1']);
    });
  });

  describe('participant departure', () => {
    it('notifies remaining participants when someone leaves', async () => {
      const { service: host, cbs: hostCbs } = await makeService('host-1');
      const code = await host.createRoom();
      const { service: guest } = await makeService('guest-1');
      await guest.joinRoom(code);

      await guest.leave();

      expect(hostCbs.onParticipantLeft).toHaveBeenCalledWith('guest-1');
    });
  });
});
