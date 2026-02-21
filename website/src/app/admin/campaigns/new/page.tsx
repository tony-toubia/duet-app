'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/hooks/useAdminStore';
import { previewEmail } from '@/services/AdminService';
import { Spinner } from '@/components/ui/Spinner';

export default function NewCampaignPage() {
  const router = useRouter();
  const { segments, loadSegments, createCampaign } = useAdminStore();

  const [name, setName] = useState('');
  const [segmentId, setSegmentId] = useState('has_email_subscribed');
  const [channels, setChannels] = useState<string[]>(['email']);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [includeUnsub, setIncludeUnsub] = useState(true);
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
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
    if (hasEmail && !subject.trim()) { setError('Email subject is required'); return; }
    if (hasEmail && !body.trim()) { setError('Email body is required'); return; }
    if (hasPush && !pushTitle.trim()) { setError('Push title is required'); return; }
    if (hasPush && !pushBody.trim()) { setError('Push body is required'); return; }

    setIsCreating(true);
    setError(null);
    try {
      const id = await createCampaign({
        name,
        segmentId,
        channels,
        email: hasEmail ? { subject, body, includeUnsub } : null,
        push: hasPush ? { title: pushTitle, body: pushBody, data: null } : null,
      });
      router.push(`/admin/campaigns/${id}`);
    } catch (err: any) {
      setError(err.message);
      setIsCreating(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">New Campaign</h1>

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
              className="w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
            />
          </div>

          {/* Segment */}
          <div>
            <label className="block text-sm text-text-muted mb-1">Target Segment</label>
            <select
              value={segmentId}
              onChange={(e) => setSegmentId(e.target.value)}
              className="w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
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

          {/* Email fields */}
          {hasEmail && (
            <>
              <div>
                <label className="block text-sm text-text-muted mb-1">Subject Line</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Exciting news from Duet"
                  className="w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">
                  Email Body (HTML)
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  placeholder="<h1>Hello!</h1><p>Your email content here...</p>"
                  className="w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm font-mono placeholder:text-text-muted/50 focus:outline-none focus:border-primary resize-y"
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

          {/* Push fields */}
          {hasPush && (
            <>
              <div>
                <label className="block text-sm text-text-muted mb-1">Push Title</label>
                <input
                  type="text"
                  value={pushTitle}
                  onChange={(e) => setPushTitle(e.target.value)}
                  placeholder="e.g. New feature!"
                  className="w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Push Body</label>
                <textarea
                  value={pushBody}
                  onChange={(e) => setPushBody(e.target.value)}
                  rows={3}
                  placeholder="Notification message..."
                  className="w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary resize-y"
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}

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
          ) : hasEmail ? (
            <div className="flex items-center justify-center h-64 bg-surface rounded-xl border border-glass-border">
              <p className="text-sm text-text-muted">
                Write email content and click Preview to see it here
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
