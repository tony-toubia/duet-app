'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useAdminStore } from '@/hooks/useAdminStore';
import { Spinner } from '@/components/ui/Spinner';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-text-muted/20 text-text-muted',
  queued: 'bg-warning/20 text-warning',
  sending: 'bg-primary/20 text-primary',
  sent: 'bg-success/20 text-success',
  failed: 'bg-danger/20 text-danger',
};

export default function CampaignsPage() {
  const { campaigns, isLoadingCampaigns, loadCampaigns } = useAdminStore();

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Campaigns</h1>
        <Link
          href="/admin/campaigns/new"
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors"
        >
          New Campaign
        </Link>
      </div>

      {isLoadingCampaigns && campaigns.length === 0 ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-text-muted mb-4">No campaigns yet.</p>
          <Link
            href="/admin/campaigns/new"
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm"
          >
            Create your first campaign
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c: any) => (
            <Link
              key={c.id}
              href={`/admin/campaigns/${c.id}`}
              className="block bg-surface rounded-xl border border-glass-border p-4 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-white">{c.name}</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] || STATUS_COLORS.draft}`}
                >
                  {c.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-text-muted">
                <span>Segment: {c.segmentId}</span>
                <span>Channels: {c.channels?.join(', ')}</span>
                {c.sentAt && <span>Sent: {new Date(c.sentAt).toLocaleDateString()}</span>}
                {c.results && (
                  <span>
                    Email: {c.results.emailsSent}/{c.results.emailsSent + c.results.emailsFailed}
                    {c.results.pushSent > 0 &&
                      ` | Push: ${c.results.pushSent}/${c.results.pushSent + c.results.pushFailed}`}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
