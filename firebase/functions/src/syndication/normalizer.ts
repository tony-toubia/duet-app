/**
 * Content Hub Syndication — Normalizer
 *
 * Shared types, deduplication, and TTL management for syndicated content.
 */

import { getDatabase } from 'firebase-admin/database';

// ─── Types ───────────────────────────────────────────────────────────

export type ContentType = 'podcast' | 'live_stream' | 'playlist';
export type ContentSource = 'manual' | 'sportsdb' | 'podcastindex' | 'spotify';

export interface ContentItem {
  id?: string;
  type: ContentType;
  title: string;
  description?: string;
  deepLink: string;
  image: string;
  city?: string | null;
  tags?: string[];
  league?: string;
  source: ContentSource;
  sourceId?: string;
  expiresAt?: number;
  pinned?: boolean;
  createdAt: number;
}

/**
 * Raw item from a syndication source, before normalization.
 */
export interface RawSyndicatedItem {
  sourceId: string;
  type: ContentType;
  title: string;
  description?: string;
  deepLink: string;
  image: string;
  city?: string;
  tags?: string[];
  league?: string;
  expiresAt?: number;
}

// ─── Constants ───────────────────────────────────────────────────────

export const CONTENT_HUB_PATH = 'content_hub/items';
export const CONTENT_HUB_CONFIG_PATH = 'content_hub/config';
export const CONTENT_HUB_STATUS_PATH = 'content_hub/sync_status';

/** Default TTL for syndicated items: 48 hours */
const DEFAULT_TTL_MS = 48 * 60 * 60 * 1000;

// ─── Normalizer ──────────────────────────────────────────────────────

/**
 * Convert raw syndicated items to ContentItems with source tagging.
 */
export function normalize(
  items: RawSyndicatedItem[],
  source: ContentSource
): ContentItem[] {
  const now = Date.now();
  return items.map((item) => ({
    type: item.type,
    title: item.title.trim(),
    description: item.description?.trim(),
    deepLink: item.deepLink,
    image: item.image,
    city: item.city || null,
    tags: item.tags || [],
    league: item.league,
    source,
    sourceId: item.sourceId,
    expiresAt: item.expiresAt || now + DEFAULT_TTL_MS,
    pinned: false,
    createdAt: now,
  }));
}

/**
 * Deduplicate items by sourceId within a source, keeping the newest.
 */
export function deduplicate(items: ContentItem[]): ContentItem[] {
  const seen = new Map<string, ContentItem>();
  for (const item of items) {
    const key = `${item.source}:${item.sourceId || item.title}`;
    const existing = seen.get(key);
    if (!existing || item.createdAt > existing.createdAt) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values());
}

// ─── Database Operations ─────────────────────────────────────────────

/**
 * Write syndicated items to RTDB, merging with existing manual/pinned items.
 * - Manual items (`source: 'manual'`) are never overwritten
 * - Pinned items survive regardless of expiry
 * - Expired syndicated items are removed
 */
export async function mergeAndWrite(
  newItems: ContentItem[],
  source: ContentSource
): Promise<{ written: number; removed: number }> {
  const db = getDatabase();
  const ref = db.ref(CONTENT_HUB_PATH);
  const now = Date.now();

  const snapshot = await ref.once('value');
  const existing: Record<string, ContentItem> = snapshot.val() || {};

  // Separate existing items by source
  const updates: Record<string, ContentItem | null> = {};
  let removed = 0;

  // 1. Remove expired items from THIS source (unless pinned)
  for (const [key, item] of Object.entries(existing)) {
    if (
      item.source === source &&
      !item.pinned &&
      item.expiresAt &&
      item.expiresAt < now
    ) {
      updates[key] = null;
      removed++;
    }
  }

  // 2. Build a lookup of existing sourceIds for this source to avoid dupes
  const existingSourceIds = new Set<string>();
  for (const item of Object.values(existing)) {
    if (item.source === source && item.sourceId) {
      existingSourceIds.add(item.sourceId);
    }
  }

  // 3. Find existing keys by sourceId for updates
  const sourceIdToKey = new Map<string, string>();
  for (const [key, item] of Object.entries(existing)) {
    if (item.source === source && item.sourceId) {
      sourceIdToKey.set(item.sourceId, key);
    }
  }

  // 4. Upsert new items
  let written = 0;
  for (const item of newItems) {
    const existingKey = item.sourceId
      ? sourceIdToKey.get(item.sourceId)
      : undefined;

    if (existingKey) {
      // Update existing — preserve pinned status
      const existingItem = existing[existingKey];
      updates[existingKey] = {
        ...item,
        pinned: existingItem?.pinned || false,
        createdAt: existingItem?.createdAt || item.createdAt,
      };
    } else {
      // New item — push with a generated key
      const newKey = ref.push().key!;
      updates[newKey] = item;
    }
    written++;
  }

  // 5. Apply all updates in a single multi-path write
  if (Object.keys(updates).length > 0) {
    await ref.update(updates);
  }

  return { written, removed };
}

/**
 * Remove all expired items across all sources.
 */
export async function cleanupExpired(): Promise<number> {
  const db = getDatabase();
  const ref = db.ref(CONTENT_HUB_PATH);
  const now = Date.now();

  const snapshot = await ref.once('value');
  const existing: Record<string, ContentItem> = snapshot.val() || {};

  const updates: Record<string, null> = {};
  for (const [key, item] of Object.entries(existing)) {
    if (
      item.source !== 'manual' &&
      !item.pinned &&
      item.expiresAt &&
      item.expiresAt < now
    ) {
      updates[key] = null;
    }
  }

  if (Object.keys(updates).length > 0) {
    await ref.update(updates);
  }

  return Object.keys(updates).length;
}

/**
 * Update sync status in RTDB for the admin dashboard.
 */
export async function updateSyncStatus(
  source: ContentSource,
  result: { written: number; removed: number; error?: string }
): Promise<void> {
  const db = getDatabase();
  await db.ref(`${CONTENT_HUB_STATUS_PATH}/${source}`).set({
    lastSyncAt: Date.now(),
    itemsWritten: result.written,
    itemsRemoved: result.removed,
    error: result.error || null,
  });
}
