import { getDatabase } from 'firebase-admin/database';

/**
 * Rate limit check helper. Uses a list of timestamps at
 * /rateLimits/{userId}/{action}. Returns true if within limit, false if
 * rate limited. /rateLimits is wiped daily by cleanupRateLimits.
 */
export async function checkRateLimit(
  userId: string,
  action: string,
  maxPerWindow: number,
  windowMs: number
): Promise<boolean> {
  const now = Date.now();
  const ref = getDatabase().ref(`/rateLimits/${userId}/${action}`);
  const snap = await ref.once('value');
  const entries: number[] = snap.val() || [];

  // Filter to only entries within the window
  const recent = entries.filter((ts: number) => now - ts < windowMs);

  if (recent.length >= maxPerWindow) {
    return false; // Rate limited
  }

  // Add current timestamp and keep only recent entries
  recent.push(now);
  await ref.set(recent);
  return true;
}
