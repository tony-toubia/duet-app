'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/hooks/useAdminStore';
import { previewEmail, createAsset, createMessage } from '@/services/AdminService';
import { Spinner } from '@/components/ui/Spinner';
import { AssetPickerModal } from '@/components/admin/AssetPickerModal';
import { MessagePicker } from '@/components/admin/MessagePicker';

export default function NewCampaignPage() {
  const router = useRouter();
  const { segments, loadSegments, createCampaign } = useAdminStore();

  const [name, setName] = useState('');
  const [segmentId, setSegmentId] = useState('has_email_subscribed');
  const [channels, setChannels] = useState<string[]>(['email']);
  // Message source: 'inline' or 'saved'
  const [emailSource, setEmailSource] = useState<'inline' | 'saved'>('inline');
  const [pushSource, setPushSource] = useState<'inline' | 'saved'>('inline');
  const [emailMessageId, setEmailMessageId] = useState<string | null>(null);
  const [pushMessageId, setPushMessageId] = useState<string | null>(null);
  // Inline email fields
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [includeUnsub, setIncludeUnsub] = useState(true);
  // Inline push fields
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [pushImageUrl, setPushImageUrl] = useState('');
  const [pushActionUrl, setPushActionUrl] = useState('');
  // UI state
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSegments();
  }, [loadSegments]);

  const hasEmail = channels.includes('email');
  const hasPush = channels.includes('push');

  const toggleChannel = (ch: string) => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const handlePreview = async () => {
    if (!body.trim()) return;
    setIsPreviewing(true);
    try {
      const { html } = await previewEmail(body, includeUnsub);
      setPreviewHtml(html);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (channels.length === 0) { setError('Select at least one channel'); return; }
    if (hasEmail && emailSource === 'saved' && !emailMessageId) { setError('Select an email message'); return; }
    if (hasEmail && emailSource === 'inline' && !subject.trim()) { setError('Email subject is required'); return; }
    if (hasEmail && emailSource === 'inline' && !body.trim()) { setError('Email body is required'); return; }
    if (hasPush && pushSource === 'saved' && !pushMessageId) { setError('Select a push message'); return; }
    if (hasPush && pushSource === 'inline' && !pushTitle.trim()) { setError('Push title is required'); return; }
    if (hasPush && pushSource === 'inline' && !pushBody.trim()) { setError('Push body is required'); return; }

    setIsCreating(true);
    setError(null);
    try {
      const trimmedImageUrl = pushImageUrl.trim() || null;
      let resolvedEmailMessageId = emailMessageId;
      let resolvedPushMessageId = pushMessageId;

      // Auto-save inline content as a message
      if (hasEmail && emailSource === 'inline') {
        const msg = await createMessage({
          name: `${name} — email`,
          channel: 'email',
          email: { subject, body, includeUnsub },
        });
        resolvedEmailMessageId = msg.id;
      }
      if (hasPush && pushSource === 'inline') {
        const msg = await createMessage({
          name: `${name} — push`,
          channel: 'push',
          push: { title: pushTitle, body: pushBody, imageUrl: trimmedImageUrl, actionUrl: pushActionUrl.trim() || null },
        });
        resolvedPushMessageId = msg.id;
      }

      const id = await createCampaign({
        name,
        segmentId,
        channels,
        email: hasEmail && emailSource === 'inline' ? { subject, body, includeUnsub } : null,
        push: hasPush && pushSource === 'inline'
          ? { title: pushTitle, body: pushBody, imageUrl: trimmedImageUrl, actionUrl: pushActionUrl.trim() || null, data: null }
          : null,
        emailMessageId: hasEmail ? resolvedEmailMessageId : null,
        pushMessageId: hasPush ? resolvedPushMessageId : null,
      });

      // Auto-save image to asset library
      if (trimmedImageUrl && trimmedImageUrl.startsWith('http')) {
        createAsset({ name: `${name} - push image`, url: trimmedImageUrl, tags: ['campaign', 'push'] }).catch(() => {});
      }
      router.push(`/admin/campaigns/${id}`);
    } catch (err: any) {
      setError(err.message);
      setIsCreating(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary';

  const sourceToggle = (
    source: 'inline' | 'saved',
    setSource: (s: 'inline' | 'saved') => void
  ) => (
    <div className="flex gap-1 mb-3">
      {(['inline', 'saved'] as const).map((s) => (
        <button
          key={s}
          onClick={() => setSource(s)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            source === s
              ? 'bg-primary/20 text-primary'
              : 'text-text-muted hover:text-white'
          }`}
        >
          {s === 'inline' ? 'Compose inline' : 'Use saved message'}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">New Batch Campaign</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm text-text-muted mb-1">Campaign Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. February newsletter"
              className={inputClass}
            />
          </div>

          {/* Segment */}
          <div>
            <label className="block text-sm text-text-muted mb-1">Target Segment</label>
            <select
              value={segmentId}
              onChange={(e) => setSegmentId(e.target.value)}
              className={inputClass}
            >
              {segments.length === 0 && (
                <option value="has_email_subscribed">Subscribed email users</option>
              )}
              {segments.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.memberCount})
                </option>
              ))}
            </select>
          </div>

          {/* Channels */}
          <div>
            <label className="block text-sm text-text-muted mb-1">Channels</label>
            <div className="flex gap-2">
              {['email', 'push'].map((ch) => (
                <button
                  key={ch}
                  onClick={() => toggleChannel(ch)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    channels.includes(ch)
                      ? 'bg-primary text-white'
                      : 'bg-glass border border-glass-border text-text-muted'
                  }`}
                >
                  {ch === 'email' ? 'Email' : 'Push'}
                </button>
              ))}
            </div>
          </div>

          {/* Email section */}
          {hasEmail && (
            <div className="p-3 bg-surface rounded-xl border border-glass-border space-y-3">
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider">Email Content</label>
              {sourceToggle(emailSource, setEmailSource)}

              {emailSource === 'saved' ? (
                <MessagePicker
                  channel="email"
                  value={emailMessageId}
                  onChange={setEmailMessageId}
                />
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Subject Line</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Exciting news from Duet"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Email Body (HTML)</label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={8}
                      placeholder="<h1>Hello!</h1><p>Your email content here...</p>"
                      className={`${inputClass} font-mono resize-y`}
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeUnsub}
                      onChange={(e) => setIncludeUnsub(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-text-muted">Include unsubscribe link</span>
                  </label>
                  <button
                    onClick={handlePreview}
                    disabled={isPreviewing || !body.trim()}
                    className="px-3 py-1.5 bg-glass border border-glass-border text-white rounded-lg text-sm hover:bg-glass-border transition-colors disabled:opacity-50"
                  >
                    {isPreviewing ? 'Loading...' : 'Preview Email'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Push section */}
          {hasPush && (
            <div className="p-3 bg-surface rounded-xl border border-glass-border space-y-3">
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider">Push Content</label>
              {sourceToggle(pushSource, setPushSource)}

              {pushSource === 'saved' ? (
                <MessagePicker
                  channel="push"
                  value={pushMessageId}
                  onChange={setPushMessageId}
                />
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Push Title</label>
                    <input
                      type="text"
                      value={pushTitle}
                      onChange={(e) => setPushTitle(e.target.value)}
                      placeholder="e.g. New feature!"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Push Body</label>
                    <textarea
                      value={pushBody}
                      onChange={(e) => setPushBody(e.target.value)}
                      rows={3}
                      placeholder="Notification message..."
                      className={`${inputClass} resize-y`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Image URL <span className="opacity-50">(optional)</span></label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={pushImageUrl}
                        onChange={(e) => setPushImageUrl(e.target.value)}
                        placeholder="https://example.com/image.png"
                        className={`flex-1 ${inputClass}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAssetPicker(true)}
                        className="px-3 py-2 bg-glass border border-glass-border rounded-lg text-xs text-text-muted hover:text-white hover:bg-glass-border transition-colors whitespace-nowrap"
                      >
                        Browse
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Action URL <span className="opacity-50">(optional — opens on tap)</span></label>
                    <input
                      type="text"
                      value={pushActionUrl}
                      onChange={(e) => setPushActionUrl(e.target.value)}
                      placeholder="https://getduet.app or duet://room/ABC123"
                      className={inputClass}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isCreating && <Spinner size="sm" />}
              Create Draft
            </button>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-glass border border-glass-border text-text-muted rounded-lg text-sm hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
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
          ) : hasEmail && emailSource === 'inline' ? (
            <div className="flex items-center justify-center h-64 bg-surface rounded-xl border border-glass-border">
              <p className="text-sm text-text-muted">
                Write email content and click Preview to see it here
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {showAssetPicker && (
        <AssetPickerModal
          onSelect={(url) => { setPushImageUrl(url); setShowAssetPicker(false); }}
          onClose={() => setShowAssetPicker(false)}
        />
      )}
    </div>
  );
}
