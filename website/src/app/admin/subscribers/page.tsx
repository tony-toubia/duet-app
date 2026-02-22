'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { searchSubscribers, fetchSubscriber } from '@/services/AdminService';
import { Spinner } from '@/components/ui/Spinner';
import { AnimatedPageIcon } from '@/components/admin/AnimatedPageIcon';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function fmtDate(ts: number | null) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function fmtRelative(ts: number | null) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(ts);
}

interface SearchResult {
  uid: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  authProvider: string | null;
  platform: string | null;
  createdAt: number | null;
}

interface SubscriberDetail {
  uid: string;
  profile: any;
  preferences: any;
  pushToken: string | null;
  platform: string | null;
  emailState: any;
  status: any;
  events: any[];
  segments: { id: string; name: string }[];
  sendHistory: any[];
}

export default function SubscribersPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selected, setSelected] = useState<SubscriberDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    setSelected(null);
    try {
      const data = await searchSubscribers(query.trim());
      setResults(data.results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  const handleSelect = useCallback(async (uid: string) => {
    setIsLoadingDetail(true);
    try {
      const data = await fetchSubscriber(uid);
      setSelected(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <AnimatedPageIcon name="subscribers" />
        <h1 className="text-2xl font-bold text-white">Subscribers</h1>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search by name, email, or user ID..."
          className="flex-1 px-4 py-2.5 bg-surface border border-glass-border rounded-lg text-white text-sm placeholder:text-text-muted focus:outline-none focus:border-primary"
        />
        <button
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
          className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors disabled:opacity-50"
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Results */}
      {!selected ? (
        <>
          {isSearching ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : results.length > 0 ? (
            <div className="bg-surface rounded-xl border border-glass-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-glass-border text-left">
                    <th className="px-4 py-3 text-text-muted font-medium">User</th>
                    <th className="px-4 py-3 text-text-muted font-medium">Email</th>
                    <th className="px-4 py-3 text-text-muted font-medium">Provider</th>
                    <th className="px-4 py-3 text-text-muted font-medium">Platform</th>
                    <th className="px-4 py-3 text-text-muted font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr
                      key={r.uid}
                      onClick={() => handleSelect(r.uid)}
                      className="border-b border-glass-border/50 hover:bg-glass/30 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {r.avatarUrl ? (
                            <Image
                              src={r.avatarUrl}
                              alt=""
                              width={28}
                              height={28}
                              className="rounded-full"
                              unoptimized
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-glass flex items-center justify-center text-xs text-text-muted">
                              {(r.displayName || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <span className="text-white">{r.displayName || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-muted">{r.email || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="px-1.5 py-0.5 rounded text-xs bg-glass text-text-muted">
                          {r.authProvider || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-muted">{r.platform || '—'}</td>
                      <td className="px-4 py-3 text-text-muted">{fmtDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : hasSearched ? (
            <div className="text-center py-12 text-text-muted">No subscribers found</div>
          ) : (
            <div className="text-center py-12 text-text-muted">
              Search for a subscriber by name, email, or user ID
            </div>
          )}
        </>
      ) : (
        /* Detail view */
        <SubscriberDetail
          data={selected}
          isLoading={isLoadingDetail}
          onBack={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function SubscriberDetail({
  data,
  isLoading,
  onBack,
}: {
  data: SubscriberDetail;
  isLoading: boolean;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'sends' | 'events'>('overview');

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'sends' as const, label: `Send History (${data.sendHistory.length})` },
    { id: 'events' as const, label: `Events (${data.events.length})` },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="text-sm text-primary hover:underline"
        >
          &larr; Back
        </button>
        <div className="flex items-center gap-3">
          {data.profile?.avatarUrl ? (
            <Image
              src={data.profile.avatarUrl}
              alt=""
              width={40}
              height={40}
              className="rounded-full"
              unoptimized
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-glass flex items-center justify-center text-lg text-text-muted">
              {(data.profile?.displayName || '?')[0].toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold text-white">
              {data.profile?.displayName || 'Unknown'}
            </h2>
            <p className="text-sm text-text-muted">{data.profile?.email || data.uid}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-glass-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-primary border-primary'
                : 'text-text-muted border-transparent hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab data={data} />}
      {activeTab === 'sends' && <SendsTab data={data} />}
      {activeTab === 'events' && <EventsTab data={data} />}
    </div>
  );
}

function OverviewTab({ data }: { data: SubscriberDetail }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Profile */}
      <div className="bg-surface rounded-xl border border-glass-border p-4">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Profile
        </h3>
        <div className="space-y-2 text-sm">
          <InfoRow label="User ID" value={data.uid} mono />
          <InfoRow label="Display Name" value={data.profile?.displayName} />
          <InfoRow label="Email" value={data.profile?.email} />
          <InfoRow label="Auth Provider" value={data.profile?.authProvider} />
          <InfoRow label="Platform" value={data.platform} />
          <InfoRow label="Joined" value={fmtDate(data.profile?.createdAt)} />
        </div>
      </div>

      {/* Status & Preferences */}
      <div className="bg-surface rounded-xl border border-glass-border p-4">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Status & Preferences
        </h3>
        <div className="space-y-2 text-sm">
          <InfoRow
            label="Online"
            value={
              <span className={data.status?.state === 'online' ? 'text-green-400' : 'text-text-muted'}>
                {data.status?.state || 'unknown'}
              </span>
            }
          />
          <InfoRow label="Last Seen" value={fmtRelative(data.status?.lastSeen)} />
          <InfoRow
            label="Email Opt-in"
            value={
              <StatusBadge ok={data.preferences?.emailOptIn !== false} />
            }
          />
          <InfoRow
            label="Push Opt-in"
            value={
              <StatusBadge ok={data.preferences?.pushOptIn !== false} />
            }
          />
          <InfoRow
            label="Push Token"
            value={data.pushToken ? 'Registered' : 'None'}
          />
          <InfoRow
            label="Unsubscribed"
            value={
              <StatusBadge ok={!data.emailState?.unsubscribed} label={data.emailState?.unsubscribed ? 'Yes' : 'No'} />
            }
          />
        </div>
      </div>

      {/* Segments */}
      <div className="bg-surface rounded-xl border border-glass-border p-4">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Segment Membership ({data.segments.length})
        </h3>
        {data.segments.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {data.segments.map((seg) => (
              <span
                key={seg.id}
                className="px-2 py-1 rounded-lg text-xs bg-primary/15 text-primary border border-primary/20"
              >
                {seg.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">Not in any segments</p>
        )}
      </div>

      {/* Email State */}
      <div className="bg-surface rounded-xl border border-glass-border p-4">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Email State
        </h3>
        <div className="space-y-2 text-sm">
          <InfoRow label="Welcome Sent" value={fmtDate(data.emailState?.welcomeSentAt)} />
          <InfoRow label="Tips Sent" value={fmtDate(data.emailState?.tipsSentAt)} />
          <InfoRow label="Re-engagement Sent" value={fmtDate(data.emailState?.reengagementSentAt)} />
          <InfoRow label="Has Created Room" value={data.emailState?.hasCreatedRoom ? 'Yes' : 'No'} />
        </div>
      </div>
    </div>
  );
}

function SendsTab({ data }: { data: SubscriberDetail }) {
  if (data.sendHistory.length === 0) {
    return <div className="text-center py-12 text-text-muted">No send history</div>;
  }

  return (
    <div className="bg-surface rounded-xl border border-glass-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-glass-border text-left">
            <th className="px-4 py-3 text-text-muted font-medium">Date</th>
            <th className="px-4 py-3 text-text-muted font-medium">Channel</th>
            <th className="px-4 py-3 text-text-muted font-medium">Source</th>
            <th className="px-4 py-3 text-text-muted font-medium">Source ID</th>
            <th className="px-4 py-3 text-text-muted font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.sendHistory.map((entry: any, i: number) => (
            <tr key={entry.id || i} className="border-b border-glass-border/50">
              <td className="px-4 py-3 text-text-muted">{fmtDate(entry.sentAt)}</td>
              <td className="px-4 py-3">
                <span className="px-1.5 py-0.5 rounded text-xs bg-glass text-text-muted">
                  {entry.channel}
                </span>
              </td>
              <td className="px-4 py-3 text-text-muted capitalize">{entry.source}</td>
              <td className="px-4 py-3 text-text-muted font-mono text-xs">{entry.sourceId}</td>
              <td className="px-4 py-3">
                {entry.success ? (
                  <span className="text-green-400">Delivered</span>
                ) : (
                  <span className="text-red-400">{entry.error || 'Failed'}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventsTab({ data }: { data: SubscriberDetail }) {
  if (data.events.length === 0) {
    return <div className="text-center py-12 text-text-muted">No events tracked</div>;
  }

  return (
    <div className="bg-surface rounded-xl border border-glass-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-glass-border text-left">
            <th className="px-4 py-3 text-text-muted font-medium">Date</th>
            <th className="px-4 py-3 text-text-muted font-medium">Event</th>
            <th className="px-4 py-3 text-text-muted font-medium">Metadata</th>
          </tr>
        </thead>
        <tbody>
          {data.events.map((evt: any, i: number) => (
            <tr key={i} className="border-b border-glass-border/50">
              <td className="px-4 py-3 text-text-muted">{fmtDate(evt.timestamp)}</td>
              <td className="px-4 py-3">
                <span className="px-1.5 py-0.5 rounded text-xs bg-glass text-white">
                  {evt.type}
                </span>
              </td>
              <td className="px-4 py-3 text-text-muted text-xs font-mono">
                {evt.metadata ? JSON.stringify(evt.metadata) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-text-muted">{label}</span>
      <span className={`text-white ${mono ? 'font-mono text-xs' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${ok ? 'bg-green-400/15 text-green-400' : 'bg-red-400/15 text-red-400'}`}>
      {label || (ok ? 'Yes' : 'No')}
    </span>
  );
}
