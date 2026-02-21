'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchCampaign, sendCampaign, previewEmail } from '@/services/AdminService';
import { Spinner } from '@/components/ui/Spinner';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-text-muted/20 text-text-muted',
  queued: 'bg-warning/20 text-warning',
  sending: 'bg-primary/20 text-primary',
  sent: 'bg-success/20 text-success',
  failed: 'bg-danger/20 text-danger',
};

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchCampaign(campaignId);
        setCampaign(data);
        // Auto-preview email
        if (data.email?.body) {
          const { html } = await previewEmail(data.email.body, data.email.includeUnsub);
          setPreviewHtml(html);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [campaignId]);

  const handleSend = async () => {
    setIsSending(true);
    setError(null);
    try {
      await sendCampaign(campaignId);
      const data = await fetchCampaign(campaignId);
      setCampaign(data);
      setShowConfirm(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && !campaign) {
    return (
      <div className="text-center py-20">
        <p className="text-danger mb-4">{error}</p>
        <Link href="/admin/campaigns" className="text-primary hover:underline">
          Back to campaigns
        </Link>
      </div>
    );
  }

  const canSend = campaign?.status === 'draft' || campaign?.status === 'queued';

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="text-text-muted hover:text-white transition-colors"
        >
          &larr;
        </button>
        <h1 className="text-2xl font-bold text-white flex-1">{campaign?.name}</h1>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[campaign?.status] || ''}`}
        >
          {campaign?.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Details */}
        <div className="space-y-4">
          <div className="bg-surface rounded-xl border border-glass-border p-4 space-y-3">
            <InfoRow label="Segment" value={campaign?.segmentId} />
            <InfoRow label="Channels" value={campaign?.channels?.join(', ')} />
            <InfoRow
              label="Created"
              value={campaign?.createdAt ? new Date(campaign.createdAt).toLocaleString() : '—'}
            />
            {campaign?.sentAt && (
              <InfoRow label="Sent" value={new Date(campaign.sentAt).toLocaleString()} />
            )}
          </div>

          {/* Email details */}
          {campaign?.email && (
            <div className="bg-surface rounded-xl border border-glass-border p-4">
              <h3 className="text-sm font-medium text-text-muted mb-2">Email</h3>
              <p className="text-white text-sm mb-1">
                <span className="text-text-muted">Subject:</span> {campaign.email.subject}
              </p>
              <p className="text-xs text-text-muted">
                Unsubscribe link: {campaign.email.includeUnsub ? 'Yes' : 'No'}
              </p>
            </div>
          )}

          {/* Push details */}
          {campaign?.push && (
            <div className="bg-surface rounded-xl border border-glass-border p-4">
              <h3 className="text-sm font-medium text-text-muted mb-2">Push Notification</h3>
              <p className="text-white text-sm font-medium">{campaign.push.title}</p>
              <p className="text-sm text-lobby-warm/70">{campaign.push.body}</p>
            </div>
          )}

          {/* Results */}
          {campaign?.results && (
            <div className="bg-surface rounded-xl border border-glass-border p-4">
              <h3 className="text-sm font-medium text-text-muted mb-3">Results</h3>
              <div className="grid grid-cols-2 gap-3">
                <ResultStat label="Targeted" value={campaign.results.totalTargeted} />
                <ResultStat label="Emails Sent" value={campaign.results.emailsSent} />
                <ResultStat label="Emails Failed" value={campaign.results.emailsFailed} />
                <ResultStat label="Push Sent" value={campaign.results.pushSent} />
                <ResultStat label="Push Failed" value={campaign.results.pushFailed} />
              </div>
            </div>
          )}

          {/* Send button */}
          {canSend && !showConfirm && (
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full px-4 py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors"
            >
              Send Campaign
            </button>
          )}

          {/* Confirm dialog */}
          {showConfirm && (
            <div className="bg-danger/10 border border-danger/30 rounded-xl p-4">
              <p className="text-sm text-white mb-3">
                Are you sure you want to send this campaign? This cannot be undone.
              </p>
              {error && <p className="text-sm text-danger mb-2">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleSend}
                  disabled={isSending}
                  className="px-4 py-2 bg-danger text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {isSending && <Spinner size="sm" />}
                  Confirm Send
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={isSending}
                  className="px-4 py-2 bg-glass border border-glass-border text-text-muted rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        <div>
          {previewHtml ? (
            <div className="sticky top-6">
              <h2 className="text-sm font-medium text-text-muted mb-2">Email Preview</h2>
              <iframe
                srcDoc={previewHtml}
                className="w-full h-[600px] rounded-xl border border-glass-border bg-white"
                sandbox="allow-same-origin"
                title="Email preview"
              />
            </div>
          ) : campaign?.push ? (
            <div className="sticky top-6">
              <h2 className="text-sm font-medium text-text-muted mb-2">Push Preview</h2>
              <div className="bg-surface rounded-xl border border-glass-border p-6">
                <div className="bg-glass rounded-lg p-4 max-w-[280px] mx-auto">
                  <p className="text-xs text-text-muted mb-1">Duet</p>
                  <p className="text-sm font-medium text-white">{campaign.push.title}</p>
                  <p className="text-sm text-lobby-warm/70">{campaign.push.body}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="text-sm text-white font-mono">{value}</span>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-glass rounded-lg p-2 text-center">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  );
}
