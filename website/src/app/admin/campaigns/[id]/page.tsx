'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchCampaign, sendCampaign, updateCampaign, previewEmail } from '@/services/AdminService';
import { useAdminStore } from '@/hooks/useAdminStore';
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
  const { segments, loadSegments } = useAdminStore();

  const [campaign, setCampaign] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editSegmentId, setEditSegmentId] = useState('');
  const [editChannels, setEditChannels] = useState<string[]>([]);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editIncludeUnsub, setEditIncludeUnsub] = useState(true);
  const [editPushTitle, setEditPushTitle] = useState('');
  const [editPushBody, setEditPushBody] = useState('');
  const [editPushImageUrl, setEditPushImageUrl] = useState('');
  const [editPushActionUrl, setEditPushActionUrl] = useState('');

  useEffect(() => {
    loadSegments();
  }, [loadSegments]);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchCampaign(campaignId);
        setCampaign(data);
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

  const startEditing = () => {
    if (!campaign) return;
    setEditName(campaign.name || '');
    setEditSegmentId(campaign.segmentId || 'has_email_subscribed');
    setEditChannels(campaign.channels || ['email']);
    setEditSubject(campaign.email?.subject || '');
    setEditBody(campaign.email?.body || '');
    setEditIncludeUnsub(campaign.email?.includeUnsub ?? true);
    setEditPushTitle(campaign.push?.title || '');
    setEditPushBody(campaign.push?.body || '');
    setEditPushImageUrl(campaign.push?.imageUrl || '');
    setEditPushActionUrl(campaign.push?.actionUrl || '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const hasEmail = editChannels.includes('email');
      const hasPush = editChannels.includes('push');
      const updated = await updateCampaign(campaignId, {
        name: editName,
        segmentId: editSegmentId,
        channels: editChannels,
        email: hasEmail ? { subject: editSubject, body: editBody, includeUnsub: editIncludeUnsub } : null,
        push: hasPush ? { title: editPushTitle, body: editPushBody, imageUrl: editPushImageUrl.trim() || null, actionUrl: editPushActionUrl.trim() || null, data: null } : null,
      });
      setCampaign(updated);
      setIsEditing(false);
      if (updated.email?.body) {
        const { html } = await previewEmail(updated.email.body, updated.email.includeUnsub);
        setPreviewHtml(html);
      } else {
        setPreviewHtml(null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!editBody.trim()) return;
    try {
      const { html } = await previewEmail(editBody, editIncludeUnsub);
      setPreviewHtml(html);
    } catch {}
  };

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

  const toggleChannel = (ch: string) => {
    setEditChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
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
  const canEdit = campaign?.status === 'draft';

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="text-text-muted hover:text-white transition-colors"
        >
          &larr;
        </button>
        <h1 className="text-2xl font-bold text-white flex-1">
          {isEditing ? 'Edit Campaign' : campaign?.name}
        </h1>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[campaign?.status] || ''}`}
        >
          {campaign?.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          {isEditing ? (
            /* ── Edit form ─────────────────────────────── */
            <>
              <div>
                <label className="block text-sm text-text-muted mb-1">Campaign Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm text-text-muted mb-1">Target Segment</label>
                <select
                  value={editSegmentId}
                  onChange={(e) => setEditSegmentId(e.target.value)}
                  className="w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
                >
                  {segments.length === 0 && (
                    <option value={editSegmentId}>{editSegmentId}</option>
                  )}
                  {segments.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.memberCount})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-text-muted mb-1">Channels</label>
                <div className="flex gap-2">
                  {['email', 'push'].map((ch) => (
                    <button
                      key={ch}
                      onClick={() => toggleChannel(ch)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        editChannels.includes(ch)
                          ? 'bg-primary text-white'
                          : 'bg-glass border border-glass-border text-text-muted'
                      }`}
                    >
                      {ch === 'email' ? 'Email' : 'Push'}
                    </button>
                  ))}
                </div>
              </div>

              {editChannels.includes('email') && (
                <>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Subject Line</label>
                    <input
                      type="text"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      className="w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Email Body (HTML)</label>
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm font-mono focus:outline-none focus:border-primary resize-y"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIncludeUnsub}
                      onChange={(e) => setEditIncludeUnsub(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-text-muted">Include unsubscribe link</span>
                  </label>
                  <button
                    onClick={handlePreview}
                    disabled={!editBody.trim()}
                    className="px-3 py-1.5 bg-glass border border-glass-border text-white rounded-lg text-sm hover:bg-glass-border transition-colors disabled:opacity-50"
                  >
                    Preview Email
                  </button>
                </>
              )}

              {editChannels.includes('push') && (
                <>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Push Title</label>
                    <input
                      type="text"
                      value={editPushTitle}
                      onChange={(e) => setEditPushTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Push Body</label>
                    <textarea
                      value={editPushBody}
                      onChange={(e) => setEditPushBody(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm focus:outline-none focus:border-primary resize-y"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Image URL <span className="opacity-50">(optional)</span></label>
                    <input
                      type="text"
                      value={editPushImageUrl}
                      onChange={(e) => setEditPushImageUrl(e.target.value)}
                      placeholder="https://example.com/image.png"
                      className="w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Action URL <span className="opacity-50">(optional — opens on tap)</span></label>
                    <input
                      type="text"
                      value={editPushActionUrl}
                      onChange={(e) => setEditPushActionUrl(e.target.value)}
                      placeholder="https://getduet.app or duet://room/ABC123"
                      className="w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
                    />
                  </div>
                </>
              )}

              {error && <p className="text-sm text-danger">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving && <Spinner size="sm" />}
                  Save Changes
                </button>
                <button
                  onClick={() => { setIsEditing(false); setError(null); }}
                  className="px-4 py-2 bg-glass border border-glass-border text-text-muted rounded-lg text-sm hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            /* ── Read-only view ─────────────────────────── */
            <>
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

              {campaign?.push && (
                <div className="bg-surface rounded-xl border border-glass-border p-4">
                  <h3 className="text-sm font-medium text-text-muted mb-2">Push Notification</h3>
                  <p className="text-white text-sm font-medium">{campaign.push.title}</p>
                  <p className="text-sm text-lobby-warm/70">{campaign.push.body}</p>
                  {campaign.push.imageUrl && (
                    <p className="text-xs text-text-muted mt-2">Image: {campaign.push.imageUrl}</p>
                  )}
                  {campaign.push.actionUrl && (
                    <p className="text-xs text-text-muted mt-1">Action: {campaign.push.actionUrl}</p>
                  )}
                </div>
              )}

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

              {/* Action buttons */}
              <div className="flex gap-3">
                {canEdit && (
                  <button
                    onClick={startEditing}
                    className="px-4 py-2 bg-glass border border-glass-border text-white rounded-lg text-sm font-medium hover:bg-glass-border transition-colors"
                  >
                    Edit Campaign
                  </button>
                )}
                {canSend && !showConfirm && (
                  <button
                    onClick={() => setShowConfirm(true)}
                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors"
                  >
                    Send Campaign
                  </button>
                )}
              </div>

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
            </>
          )}
        </div>

        {/* Preview panel */}
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
          ) : (campaign?.push || (isEditing && editChannels.includes('push'))) ? (
            <div className="sticky top-6">
              <h2 className="text-sm font-medium text-text-muted mb-2">Push Preview</h2>
              <div className="bg-surface rounded-xl border border-glass-border p-6">
                <div className="bg-glass rounded-lg p-4 max-w-[280px] mx-auto">
                  <p className="text-xs text-text-muted mb-1">Duet</p>
                  <p className="text-sm font-medium text-white">
                    {isEditing ? editPushTitle : campaign?.push?.title}
                  </p>
                  <p className="text-sm text-lobby-warm/70">
                    {isEditing ? editPushBody : campaign?.push?.body}
                  </p>
                  {(isEditing ? editPushImageUrl : campaign?.push?.imageUrl) && (
                    <img
                      src={isEditing ? editPushImageUrl : campaign?.push?.imageUrl}
                      className="w-full rounded-md mt-2 max-h-32 object-cover"
                      alt="Push image"
                    />
                  )}
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
