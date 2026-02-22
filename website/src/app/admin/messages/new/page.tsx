'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/hooks/useAdminStore';
import { previewEmail } from '@/services/AdminService';
import { Spinner } from '@/components/ui/Spinner';
import { ImageUploadField } from '@/components/admin/ImageUploadField';

export default function NewMessagePage() {
  const router = useRouter();
  const { createMessage } = useAdminStore();

  const [name, setName] = useState('');
  const [channel, setChannel] = useState<'email' | 'push'>('email');
  // Email fields
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [includeUnsub, setIncludeUnsub] = useState(true);
  // Push fields
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [pushImageUrl, setPushImageUrl] = useState('');
  const [pushActionUrl, setPushActionUrl] = useState('');
  // UI state
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (channel === 'email' && !subject.trim()) { setError('Subject is required'); return; }
    if (channel === 'email' && !body.trim()) { setError('Email body is required'); return; }
    if (channel === 'push' && !pushTitle.trim()) { setError('Push title is required'); return; }
    if (channel === 'push' && !pushBody.trim()) { setError('Push body is required'); return; }

    setIsSaving(true);
    setError(null);
    try {
      await createMessage({
        name,
        channel,
        email: channel === 'email' ? { subject, body, includeUnsub } : null,
        push: channel === 'push'
          ? { title: pushTitle, body: pushBody, imageUrl: pushImageUrl.trim() || null, actionUrl: pushActionUrl.trim() || null }
          : null,
      });
      router.push('/admin/messages');
    } catch (err: any) {
      setError(err.message);
      setIsSaving(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary';

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">New Message</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm text-text-muted mb-1">Message Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Welcome email v2"
              className={inputClass}
            />
          </div>

          {/* Channel */}
          <div>
            <label className="block text-sm text-text-muted mb-1">Channel</label>
            <div className="flex gap-2">
              {(['email', 'push'] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    channel === ch
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
          {channel === 'email' && (
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

          {/* Push fields */}
          {channel === 'push' && (
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
              <ImageUploadField
                value={pushImageUrl}
                onChange={setPushImageUrl}
              />
              <div>
                <label className="block text-sm text-text-muted mb-1">
                  Action URL <span className="opacity-50">(optional — opens on tap)</span>
                </label>
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

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving && <Spinner size="sm" />}
              Save Message
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
          ) : channel === 'email' ? (
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
