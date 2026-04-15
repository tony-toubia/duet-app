/**
 * Content Hub Syndication — Orchestrator
 *
 * Scheduled Cloud Function that fetches content from all enabled sources,
 * normalizes it, and writes to Firebase RTDB.
 *
 * Runs every 6 hours. Can also be triggered manually via HTTPS callable.
 *
 * Secret requirements:
 * - SportsDB: NONE (free API key '123' used by default)
 * - Podcast Index: PODCAST_INDEX_API_KEY, PODCAST_INDEX_API_SECRET
 * - Spotify: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET (optional — skipped if not set)
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getDatabase } from 'firebase-admin/database';
import {
  normalize,
  deduplicate,
  mergeAndWrite,
  cleanupExpired,
  updateSyncStatus,
  CONTENT_HUB_CONFIG_PATH,
  CONTENT_HUB_STATUS_PATH,
} from './normalizer';
import { fetchSportsContent } from './sources/sportsdb';
import { fetchPodcastContent } from './sources/podcastindex';
import { fetchSpotifyContent } from './sources/spotify';

// ─── Secrets ─────────────────────────────────────────────────────────
// SportsDB uses free key '123' — no secret needed.

const podcastIndexApiKey = defineSecret('PODCAST_INDEX_API_KEY');
const podcastIndexApiSecret = defineSecret('PODCAST_INDEX_API_SECRET');
const spotifyClientId = defineSecret('SPOTIFY_CLIENT_ID');
const spotifyClientSecret = defineSecret('SPOTIFY_CLIENT_SECRET');

// ─── Config loader ──────────────────────────────────────────────────

interface SourceConfig {
  sportsdb?: {
    enabled: boolean;
    leagues?: string[];
  };
  podcastindex?: {
    enabled: boolean;
    categories?: string[];
    maxItems?: number;
  };
  spotify?: {
    enabled: boolean;
    categories?: string[];
    maxItems?: number;
  };
}

async function loadConfig(): Promise<SourceConfig> {
  const db = getDatabase();
  const snap = await db.ref(CONTENT_HUB_CONFIG_PATH).once('value');
  const config = snap.val();

  // Default config if nothing is stored
  if (!config) {
    return {
      sportsdb: { enabled: true },
      podcastindex: { enabled: true },
      spotify: { enabled: true },
    };
  }

  return config;
}

/**
 * Safely read a secret value, returning empty string if not configured.
 */
function safeSecret(secret: ReturnType<typeof defineSecret>): string {
  try {
    const val = secret.value();
    // Reject empty or placeholder values
    if (!val || val === 'placeholder') return '';
    return val;
  } catch {
    return '';
  }
}

// ─── Sync logic ─────────────────────────────────────────────────────

async function runSync(): Promise<Record<string, any>> {
  const config = await loadConfig();
  const results: Record<string, any> = {};

  // 1. TheSportsDB — no secret needed, uses free key '123'
  if (config.sportsdb?.enabled !== false) {
    try {
      console.log('[Syndication] Syncing TheSportsDB...');
      const raw = await fetchSportsContent({
        leagues: config.sportsdb?.leagues,
      });
      const normalized = deduplicate(normalize(raw, 'sportsdb'));
      const result = await mergeAndWrite(normalized, 'sportsdb');
      await updateSyncStatus('sportsdb', result);
      results.sportsdb = result;
      console.log(`[Syndication] SportsDB: ${result.written} written, ${result.removed} removed`);
    } catch (e: any) {
      console.error('[Syndication] SportsDB failed:', e);
      await updateSyncStatus('sportsdb', { written: 0, removed: 0, error: e.message });
      results.sportsdb = { error: e.message };
    }
  }

  // 2. Podcast Index
  if (config.podcastindex?.enabled !== false) {
    const piKey = safeSecret(podcastIndexApiKey);
    const piSecret = safeSecret(podcastIndexApiSecret);

    if (!piKey || !piSecret) {
      console.warn('[Syndication] Podcast Index secrets not configured, skipping');
      results.podcastindex = { skipped: true, reason: 'secrets not configured' };
    } else {
      try {
        console.log('[Syndication] Syncing Podcast Index...');
        const raw = await fetchPodcastContent({
          apiKey: piKey,
          apiSecret: piSecret,
          categories: config.podcastindex?.categories,
          maxItems: config.podcastindex?.maxItems,
        });
        const normalized = deduplicate(normalize(raw, 'podcastindex'));
        const result = await mergeAndWrite(normalized, 'podcastindex');
        await updateSyncStatus('podcastindex', result);
        results.podcastindex = result;
        console.log(`[Syndication] PodcastIndex: ${result.written} written, ${result.removed} removed`);
      } catch (e: any) {
        console.error('[Syndication] PodcastIndex failed:', e);
        await updateSyncStatus('podcastindex', { written: 0, removed: 0, error: e.message });
        results.podcastindex = { error: e.message };
      }
    }
  }

  // 3. Spotify — optional, skipped if secrets not configured
  if (config.spotify?.enabled !== false) {
    const spClientId = safeSecret(spotifyClientId);
    const spClientSecret = safeSecret(spotifyClientSecret);

    if (!spClientId || !spClientSecret) {
      console.warn('[Syndication] Spotify secrets not configured, skipping');
      results.spotify = { skipped: true, reason: 'secrets not configured' };
    } else {
      try {
        console.log('[Syndication] Syncing Spotify...');
        const raw = await fetchSpotifyContent({
          clientId: spClientId,
          clientSecret: spClientSecret,
          categories: config.spotify?.categories,
          maxItems: config.spotify?.maxItems,
        });
        const normalized = deduplicate(normalize(raw, 'spotify'));
        const result = await mergeAndWrite(normalized, 'spotify');
        await updateSyncStatus('spotify', result);
        results.spotify = result;
        console.log(`[Syndication] Spotify: ${result.written} written, ${result.removed} removed`);
      } catch (e: any) {
        console.error('[Syndication] Spotify failed:', e);
        await updateSyncStatus('spotify', { written: 0, removed: 0, error: e.message });
        results.spotify = { error: e.message };
      }
    }
  }

  // 4. Cleanup expired items across all sources
  const expired = await cleanupExpired();
  results.expiredCleaned = expired;
  console.log(`[Syndication] Cleaned up ${expired} expired items`);

  // 5. Update overall sync timestamp
  const db = getDatabase();
  await db.ref(`${CONTENT_HUB_STATUS_PATH}/lastFullSync`).set(Date.now());

  return results;
}

// ─── Scheduled Function ─────────────────────────────────────────────

/**
 * Runs every 6 hours to sync content from all enabled sources.
 * Only secrets that are actually provisioned need to be listed here.
 */
export const syncContentHub = onSchedule(
  {
    schedule: 'every 6 hours',
    region: 'us-central1',
    secrets: [
      podcastIndexApiKey,
      podcastIndexApiSecret,
      spotifyClientId,
      spotifyClientSecret,
    ],
  },
  async () => {
    const results = await runSync();
    console.log('[Syndication] Full sync complete:', JSON.stringify(results));
  }
);

/**
 * HTTPS endpoint to trigger a manual sync (from admin dashboard).
 */
export const triggerContentSync = onRequest(
  {
    region: 'us-central1',
    secrets: [
      podcastIndexApiKey,
      podcastIndexApiSecret,
      spotifyClientId,
      spotifyClientSecret,
    ],
  },
  async (req, res) => {
    // Basic admin check
    const adminUids = (process.env.ADMIN_UIDS || '').split(',').filter(Boolean);
    const uid = req.query.uid as string | undefined;

    if (adminUids.length > 0 && (!uid || !adminUids.includes(uid))) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const results = await runSync();
      res.status(200).json({ success: true, results });
    } catch (e: any) {
      console.error('[Syndication] Manual sync failed:', e);
      res.status(500).json({ error: e.message });
    }
  }
);
