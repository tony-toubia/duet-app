'use client';

import { useState, useEffect } from 'react';
import { firebaseDb as database } from '@/services/firebase';
import { ref, onValue, push, remove, set } from 'firebase/database';
import { AnimatedPageIcon } from '@/components/admin/AnimatedPageIcon';

interface ContentItem {
  id: string;
  type: 'podcast' | 'live_stream' | 'playlist';
  title: string;
  description?: string;
  deepLink: string;
  image: string;
  city?: string | null;
  tags?: string[];
  league?: string;
  source: 'manual' | 'sportsdb' | 'podcastindex' | 'spotify';
  sourceId?: string;
  expiresAt?: number;
  pinned?: boolean;
  createdAt: number;
}

interface SyncStatus {
  lastSyncAt?: number;
  itemsWritten?: number;
  itemsRemoved?: number;
  error?: string | null;
}

interface SyncStatuses {
  sportsdb?: SyncStatus;
  podcastindex?: SyncStatus;
  spotify?: SyncStatus;
  lastFullSync?: number;
}

const SOURCE_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  manual: { label: 'Manual', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', emoji: '✍️' },
  sportsdb: { label: 'SportsDB', color: 'bg-green-500/20 text-green-400 border-green-500/30', emoji: '⚽' },
  podcastindex: { label: 'Podcast Index', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', emoji: '🎧' },
  spotify: { label: 'Spotify', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', emoji: '🎵' },
};

const TYPE_EMOJI: Record<string, string> = {
  podcast: '🎙️',
  live_stream: '📺',
  playlist: '🎶',
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function timeUntil(ts: number): string {
  const diff = ts - Date.now();
  if (diff <= 0) return 'expired';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

export default function ContentHubAdmin() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatuses>({});
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  // Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'podcast' | 'live_stream' | 'playlist'>('podcast');
  const [deepLink, setDeepLink] = useState('');
  const [image, setImage] = useState('');
  const [city, setCity] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    // Listen to content items
    const contentRef = ref(database, 'content_hub/items');
    const unsubContent = onValue(
      contentRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const parsed = Object.keys(data).map(key => ({
            id: key,
            source: 'manual' as const, // Default for legacy
            ...data[key],
          })).sort((a, b) => b.createdAt - a.createdAt);
          setContent(parsed);
        } else {
          // Fallback to legacy path
          const legacyRef = ref(database, 'worldcup/content');
          onValue(legacyRef, (legacySnap) => {
            const legacyData = legacySnap.val();
            if (legacyData) {
              const parsed = Object.keys(legacyData).map(key => ({
                id: key,
                source: 'manual' as const,
                ...legacyData[key],
              })).sort((a, b) => b.createdAt - a.createdAt);
              setContent(parsed);
            } else {
              setContent([]);
            }
          }, { onlyOnce: true });
        }
      },
      (error) => {
        console.error('[ContentHub] Firebase listener error:', error);
        setContent([]);
      }
    );

    // Listen to sync status
    const statusRef = ref(database, 'content_hub/sync_status');
    const unsubStatus = onValue(
      statusRef,
      (snapshot) => {
        setSyncStatus(snapshot.val() || {});
      },
      (error) => {
        console.error('[ContentHub] Sync status listener error:', error);
      }
    );

    return () => {
      unsubContent();
      unsubStatus();
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !deepLink) return;

    const contentRef = ref(database, 'content_hub/items');
    const newDoc = push(contentRef);
    await set(newDoc, {
      title,
      type,
      deepLink,
      image,
      city: city || null,
      source: 'manual',
      pinned: true, // Manual items are always pinned
      createdAt: Date.now(),
    });

    setTitle('');
    setDeepLink('');
    setImage('');
    setCity('');
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this content item?')) {
      await remove(ref(database, `content_hub/items/${id}`));
    }
  };

  const handleTogglePin = async (item: ContentItem) => {
    await set(
      ref(database, `content_hub/items/${item.id}/pinned`),
      !item.pinned
    );
  };

  // Filter content by source
  const filteredContent = sourceFilter === 'all'
    ? content
    : content.filter(c => c.source === sourceFilter);

  // Compute source counts
  const sourceCounts = content.reduce((acc, item) => {
    acc[item.source] = (acc[item.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <AnimatedPageIcon name="dashboard" />
        <h1 className="text-2xl font-bold text-white">Content Hub Administration</h1>
      </div>

      {/* ── Syndication Status Panel ── */}
      <div className="bg-surface rounded-xl border border-glass-border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Syndication Status</h2>
          {syncStatus.lastFullSync && (
            <span className="text-xs text-text-muted">
              Last full sync: {timeAgo(syncStatus.lastFullSync)}
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {(['sportsdb', 'podcastindex', 'spotify'] as const).map((source) => {
            const status = syncStatus[source];
            const meta = SOURCE_LABELS[source];
            return (
              <div
                key={source}
                className="bg-glass rounded-lg border border-glass-border p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{meta.emoji}</span>
                  <span className="font-medium text-white text-sm">{meta.label}</span>
                </div>
                {status ? (
                  <>
                    <p className="text-xs text-text-muted">
                      Synced {timeAgo(status.lastSyncAt || 0)}
                    </p>
                    <p className="text-xs text-text-muted">
                      {status.itemsWritten || 0} items • {status.itemsRemoved || 0} expired
                    </p>
                    {status.error && (
                      <p className="text-xs text-red-400 mt-1 truncate" title={status.error}>
                        ⚠️ {status.error}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-text-muted">Not synced yet</p>
                )}
                <p className="text-xs text-text-muted mt-1">
                  {sourceCounts[source] || 0} active items
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Manual Add ── */}
      <div className="bg-surface rounded-xl border border-glass-border p-6 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Manual Content</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-sm px-4 py-1.5 rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors"
          >
            {showForm ? 'Cancel' : '+ Add Item'}
          </button>
        </div>
        {showForm && (
          <form onSubmit={handleCreate} className="space-y-4 max-w-2xl mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-muted mb-1">Title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full bg-glass border border-glass-border rounded-lg px-4 py-2 text-white" placeholder="Match Day Playlist" />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Type</label>
                <select value={type} onChange={e => setType(e.target.value as any)} className="w-full bg-glass border border-glass-border rounded-lg px-4 py-2 text-white">
                  <option value="podcast">Podcast</option>
                  <option value="playlist">Playlist</option>
                  <option value="live_stream">Live Stream</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Deep Link URL (e.g. spotify://)</label>
              <input type="text" value={deepLink} onChange={e => setDeepLink(e.target.value)} required className="w-full bg-glass border border-glass-border rounded-lg px-4 py-2 text-white" placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-muted mb-1">Cover Image URL</label>
                <input type="text" value={image} onChange={e => setImage(e.target.value)} className="w-full bg-glass border border-glass-border rounded-lg px-4 py-2 text-white" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Target City (Optional)</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)} className="w-full bg-glass border border-glass-border rounded-lg px-4 py-2 text-white" placeholder="e.g. Kansas City" />
              </div>
            </div>
            <button type="submit" className="px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-light transition-colors">
              Create Content
            </button>
          </form>
        )}
      </div>

      {/* ── Content Pool ── */}
      <div className="bg-surface rounded-xl border border-glass-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Active Content Pool
            <span className="text-sm font-normal text-text-muted ml-2">({filteredContent.length} items)</span>
          </h2>
          <div className="flex gap-1">
            {['all', 'manual', 'sportsdb', 'podcastindex', 'spotify'].map((src) => (
              <button
                key={src}
                onClick={() => setSourceFilter(src)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  sourceFilter === src
                    ? 'bg-primary/20 text-primary'
                    : 'text-text-muted hover:text-white hover:bg-glass'
                }`}
              >
                {src === 'all' ? 'All' : SOURCE_LABELS[src]?.emoji || ''} {src === 'all' ? '' : sourceCounts[src] || 0}
              </button>
            ))}
          </div>
        </div>

        {filteredContent.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-muted text-sm">
              {content.length === 0
                ? 'No content yet. Syndication feeds will populate automatically, or add items manually above.'
                : 'No items match the current filter.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-glass-border">
            {filteredContent.map(item => {
              const srcMeta = SOURCE_LABELS[item.source] || SOURCE_LABELS.manual;
              const isExpired = item.expiresAt && item.expiresAt < Date.now();
              return (
                <div
                  key={item.id}
                  className={`py-4 flex items-center gap-4 ${isExpired ? 'opacity-50' : ''}`}
                >
                  {/* Thumbnail */}
                  {item.image && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.image}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-glass"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm">{TYPE_EMOJI[item.type] || '📄'}</span>
                      <h3 className="text-white font-medium text-sm truncate">{item.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${srcMeta.color}`}>
                        {srcMeta.emoji} {srcMeta.label}
                      </span>
                      {item.league && (
                        <span className="text-xs text-text-muted">
                          {item.league}
                        </span>
                      )}
                      <span className="text-xs text-text-muted">
                        {item.city || 'Global'}
                      </span>
                      {item.expiresAt && (
                        <span className={`text-xs ${isExpired ? 'text-red-400' : 'text-text-muted'}`}>
                          {isExpired ? '⏰ expired' : `expires ${timeUntil(item.expiresAt)}`}
                        </span>
                      )}
                      {item.pinned && (
                        <span className="text-xs text-yellow-400">📌 pinned</span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5 font-mono truncate">{item.deepLink}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleTogglePin(item)}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                        item.pinned
                          ? 'text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10'
                          : 'text-text-muted border-glass-border hover:text-yellow-400 hover:border-yellow-500/30'
                      }`}
                      title={item.pinned ? 'Unpin (allow expiry)' : 'Pin (prevent expiry)'}
                    >
                      {item.pinned ? '📌' : '📍'}
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-red-400 hover:text-red-300 text-xs border border-red-500/30 px-2.5 py-1 rounded-md hover:bg-red-500/10 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
