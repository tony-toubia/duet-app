import { describe, it, expect } from 'vitest';
import { isRoomStale, HEARTBEAT_FRESH_MS } from '../roomCleanup';

const HOUR = 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 1);

describe('isRoomStale', () => {
  it('keeps rooms younger than a day', () => {
    expect(isRoomStale({ createdAt: now - 23 * HOUR }, now)).toBe(false);
  });

  it('deletes an old empty room', () => {
    expect(isRoomStale({ createdAt: now - 25 * HOUR }, now)).toBe(true);
    expect(isRoomStale({ createdAt: now - 25 * HOUR, members: {} }, now)).toBe(true);
  });

  it('keeps an old room that is still in use (fresh heartbeat)', () => {
    const room = {
      createdAt: now - 3 * 24 * HOUR,
      members: { a: { heartbeat: now - 20_000 }, b: { heartbeat: now - 2 * HOUR } },
    };
    expect(isRoomStale(room, now)).toBe(false);
  });

  it('deletes an old room whose heartbeats have all stopped', () => {
    const room = { createdAt: now - 30 * HOUR, members: { a: { heartbeat: now - HEARTBEAT_FRESH_MS - 1 } } };
    expect(isRoomStale(room, now)).toBe(true);
  });

  it('keeps an occupied party room (no heartbeats) up to 7 days', () => {
    const members = { a: { joinedAt: now - 30 * HOUR } };
    expect(isRoomStale({ createdAt: now - 2 * 24 * HOUR, members }, now)).toBe(false);
    expect(isRoomStale({ createdAt: now - 8 * 24 * HOUR, members }, now)).toBe(true);
  });

  it('treats missing data as stale', () => {
    expect(isRoomStale(null, now)).toBe(true);
    expect(isRoomStale({}, now)).toBe(true);
  });
});
