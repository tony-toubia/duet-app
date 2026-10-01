/**
 * Which rooms the hourly cleanup may delete.
 *
 * Rooms used to be deleted 24 hours after creation regardless of use,
 * which cut off long-running "always-on" conversations. A room is now
 * only removed once nobody is using it:
 * - rooms less than a day old are left alone (members' onDisconnect
 *   handlers and onRoomEmpty clean those up);
 * - an older room with no members is deleted;
 * - 1:1 members write a heartbeat every 10 seconds, so a room whose
 *   heartbeats have all gone quiet holds only ghost entries and is deleted;
 * - party-room members don't heartbeat; they're removed by onDisconnect,
 *   so present members mean the room is in use, up to a 7-day cap.
 */
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
export const HEARTBEAT_FRESH_MS = 10 * 60 * 1000;
export const NO_HEARTBEAT_CAP_MS = 7 * 24 * 60 * 60 * 1000;

interface RoomLike {
  createdAt?: number;
  members?: Record<string, { heartbeat?: unknown; joinedAt?: unknown } | null>;
}

export function isRoomStale(room: RoomLike | null | undefined, now = Date.now()): boolean {
  if (!room) return true;
  const createdAt = typeof room.createdAt === 'number' ? room.createdAt : 0;
  if (now - createdAt < STALE_AFTER_MS) return false;

  const members = Object.values(room.members || {}).filter(Boolean) as { heartbeat?: unknown }[];
  if (members.length === 0) return true;

  const heartbeats = members
    .map((m) => m.heartbeat)
    .filter((h): h is number => typeof h === 'number');
  if (heartbeats.some((h) => now - h < HEARTBEAT_FRESH_MS)) return false;
  if (heartbeats.length > 0) return true;

  return now - createdAt > NO_HEARTBEAT_CAP_MS;
}
