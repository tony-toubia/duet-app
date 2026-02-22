'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useAdminStore } from '@/hooks/useAdminStore';
import { Spinner } from '@/components/ui/Spinner';
import { AnimatedPageIcon } from '@/components/admin/AnimatedPageIcon';

export default function AdminDashboard() {
  const { stats, isLoadingStats, loadStats } = useAdminStore();

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (isLoadingStats && !stats) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <AnimatedPageIcon name="dashboard" />
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Users" value={stats?.userCount ?? '—'} />
        <StatCard label="Campaigns Sent" value={stats?.sentCampaigns ?? '—'} />
        <StatCard
          label="Emails Today"
          value={`${stats?.emailsToday ?? 0} / ${stats?.emailDailyLimit ?? 100}`}
        />
        <StatCard
          label="Segments"
          value={stats?.segmentSummary?.length ?? '—'}
        />
      </div>

      {/* Segment summary */}
      {stats?.segmentSummary && stats.segmentSummary.length > 0 && (
        <div className="bg-surface rounded-xl border border-glass-border p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Segments</h2>
            <Link
              href="/admin/segments"
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {stats.segmentSummary.map((seg) => (
              <div
                key={seg.id}
                className="bg-glass rounded-lg px-3 py-2 flex items-center justify-between"
              >
                <span className="text-sm text-lobby-warm/80 truncate">{seg.name}</span>
                <span className="text-sm font-mono text-white ml-2">{seg.memberCount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-3">
        <Link
          href="/admin/campaigns/new"
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors"
        >
          New Campaign
        </Link>
        <Link
          href="/admin/segments"
          className="px-4 py-2 bg-glass border border-glass-border text-white rounded-lg text-sm font-medium hover:bg-glass-border transition-colors"
        >
          Manage Segments
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface rounded-xl border border-glass-border p-4">
      <p className="text-xs text-text-muted uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
