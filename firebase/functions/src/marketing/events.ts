import { getDatabase } from 'firebase-admin/database';
import type { TrackableEvent, TrackedEvent } from './types';

/**
 * Log an event for a user.
 * Path: events/{userId}/{eventType}/{pushId}
 */
export async function logEvent(
  userId: string,
  eventType: TrackableEvent,
  metadata?: Record<string, string>
): Promise<void> {
  const db = getDatabase();
  const entry: TrackedEvent = {
    type: eventType,
    timestamp: Date.now(),
    ...(metadata ? { metadata } : {}),
  };
  await db.ref(`events/${userId}/${eventType}`).push(entry);
}

/**
 * Check if a user has any event of the given type since a timestamp.
 */
export async function hasEventSince(
  userId: string,
  eventType: TrackableEvent,
  sinceTimestamp: number
): Promise<boolean> {
  const db = getDatabase();
  const snap = await db
    .ref(`events/${userId}/${eventType}`)
    .orderByChild('timestamp')
    .startAt(sinceTimestamp)
    .limitToFirst(1)
    .once('value');
  return snap.exists();
}

/**
 * Get the most recent event of a given type for a user.
 */
export async function getLatestEvent(
  userId: string,
  eventType: TrackableEvent
): Promise<TrackedEvent | null> {
  const db = getDatabase();
  const snap = await db
    .ref(`events/${userId}/${eventType}`)
    .orderByChild('timestamp')
    .limitToLast(1)
    .once('value');
  if (!snap.exists()) return null;
  let latest: TrackedEvent | null = null;
  snap.forEach((child) => {
    latest = child.val() as TrackedEvent;
  });
  return latest;
}
