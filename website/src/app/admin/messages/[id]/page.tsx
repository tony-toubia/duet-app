'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchMessage, previewEmail } from '@/services/AdminService';
import { useAdminStore } from '@/hooks/useAdminStore';
import { Spinner } from '@/components/ui/Spinner';
import { AssetPickerModal } from '@/components/admin/AssetPickerModal';

export default function MessageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { updateMessage, deleteMessage } = useAdminStore();

  const [message, setMessage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit fields
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [includeUnsub, setIncludeUnsub] = useState(true);
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [pushImageUrl, setPushImageUrl] = useState('');
  const [pushActionUrl, setPushActionUrl] = useState('');

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMessage(id)
      .then((data) => {
        setMessage(data);
        populateFields(data);
      })
      .catch(() => setError('Failed to load message'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const populateFields = (msg: any) => {
    setName(msg.name || '');
    if (msg.channel === 'email' && msg.email) {
      setSubject(msg.email.subject || '');
      setBody(msg.email.body || '');
      setIncludeUnsub(msg.email.includeUnsub ?? true);
    }
    if (msg.channel === 'push' && msg.push) {
      setPushTitle(msg.push.title || '');
      setPushBody(msg.push.body || '');
      setPushImageUrl(msg.push.imageUrl || '');
      setPushActionUrl(msg.push.actionUrl || '');
    }
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

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setIsSaving(true);
    setError(null);
    try {
      const updates: any = { name };
      if (message.channel === 'email') {
        updates.email = { subject, body, includeUnsub };
      } else {
        updates.push = {
          title: pushTitle,
          body: pushBody,
          imageUrl: pushImageUrl.trim() || null,
          actionUrl: pushActionUrl.trim() || null,
        };
      }
      await updateMessage(id, updates);
      const refreshed = await fetchMessage(id);
      setMessage(refreshed);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this message? This cannot be undone.')) return;
    setIsDeleting(true);
    try {
      await deleteMessage(id);
      router.push('/admin/messages');
    } catch (err: any) {
      setError(err.message);
      setIsDeleting(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary';

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!message) {
    return <p className="text-text-muted text-center py-20">Message not found.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/admin/messages')}
            className="text-text-muted hover:text-white text-sm transition-colors"
          >
            &larr; Messages
          </button>
          <h1 className="text-xl font-bold text-white">{message.name}</h1>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
              message.channel === 'email'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            {message.channel}
          </span>
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 bg-glass border border-glass-border text-white rounded-lg text-sm hover:bg-glass-border transition-colors"
            >
              Edit
            </button>
          ) : (
            <button
              onClick={() => { setIsEditing(false); populateFields(message); setError(null); }}
              className="px-3 py-1.5 bg-glass border border-glass-border text-text-muted rounded-lg text-sm hover:text-white transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {isEditing ? (
            <>
              <div>
                <label className="block text-sm text-text-muted mb-1">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </div>

              {message.channel === 'email' && (
                <>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Subject Line</label>
                    <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Email Body (HTML)</label>
                    <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} className={`${inputClass} font-mono resize-y`} />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={includeUnsub} onChange={(e) => setIncludeUnsub(e.target.checked)} className="rounded" />
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

              {message.channel === 'push' && (
                <>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Push Title</label>
                    <input type="text" value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Push Body</label>
                    <textarea value={pushBody} onChange={(e) => setPushBody(e.target.value)} rows={3} className={`${inputClass} resize-y`} />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Image URL <span className="opacity-50">(optional)</span></label>
                    <div className="flex gap-2">
                      <input type="text" value={pushImageUrl} onChange={(e) => setPushImageUrl(e.target.value)} className={`${inputClass} flex-1`} />
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
                    <label className="block text-sm text-text-muted mb-1">Action URL <span className="opacity-50">(optional)</span></label>
                    <input type="text" value={pushActionUrl} onChange={(e) => setPushActionUrl(e.target.value)} className={inputClass} />
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
              </div>

              <div className="pt-4 border-t border-glass-border">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-danger/10 border border-danger/30 text-danger rounded-lg text-sm hover:bg-danger/20 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Message'}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Read-only view */}
              {message.channel === 'email' && message.email && (
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-text-muted uppercase tracking-wider">Subject</span>
                    <p className="text-white mt-1">{message.email.subject}</p>
                  </div>
                  <div>
                    <span className="text-xs text-text-muted uppercase tracking-wider">Body</span>
                    <pre className="mt-1 p-3 bg-glass border border-glass-border rounded-lg text-sm text-white font-mono whitespace-pre-wrap overflow-auto max-h-64">
                      {message.email.body}
                    </pre>
                  </div>
                  <div>
                    <span className="text-xs text-text-muted">
                      Unsubscribe link: {message.email.includeUnsub ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              )}

              {message.channel === 'push' && message.push && (
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-text-muted uppercase tracking-wider">Title</span>
                    <p className="text-white mt-1">{message.push.title}</p>
                  </div>
                  <div>
                    <span className="text-xs text-text-muted uppercase tracking-wider">Body</span>
                    <p className="text-white mt-1">{message.push.body}</p>
                  </div>
                  {message.push.imageUrl && (
                    <div>
                      <span className="text-xs text-text-muted uppercase tracking-wider">Image</span>
                      <div className="mt-1 rounded-lg overflow-hidden border border-glass-border bg-glass inline-block">
                        <img src={message.push.imageUrl} alt="" className="max-h-32 object-contain" />
                      </div>
                    </div>
                  )}
                  {message.push.actionUrl && (
                    <div>
                      <span className="text-xs text-text-muted uppercase tracking-wider">Action URL</span>
                      <p className="text-white mt-1 text-sm">{message.push.actionUrl}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-3 text-xs text-text-muted">
                Created {message.createdAt ? new Date(message.createdAt).toLocaleString() : 'N/A'}
                {message.updatedAt && message.updatedAt !== message.createdAt && (
                  <> &middot; Updated {new Date(message.updatedAt).toLocaleString()}</>
                )}
              </div>
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
          ) : message.channel === 'email' && isEditing ? (
            <div className="flex items-center justify-center h-64 bg-surface rounded-xl border border-glass-border">
              <p className="text-sm text-text-muted">
                Click Preview to see the rendered email
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
