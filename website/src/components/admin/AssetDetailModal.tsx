'use client';

import { useEffect, useState } from 'react';
import { updateAsset, deleteAsset, fetchAssetUsage } from '@/services/AdminService';

interface AssetDetailModalProps {
  asset: any;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

export function AssetDetailModal({ asset, onClose, onUpdated, onDeleted }: AssetDetailModalProps) {
  const [name, setName] = useState(asset.name || '');
  const [description, setDescription] = useState(asset.description || '');
  const [tags, setTags] = useState((asset.tags || []).join(', '));
  const [usage, setUsage] = useState<{ type: string; id: string; name: string }[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAssetUsage(asset.id)
      .then((data) => setUsage(data.usage))
      .catch(() => setUsage([]));
  }, [asset.id]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const parsedTags = tags
        .split(',')
        .map((t: string) => t.trim().toLowerCase())
        .filter(Boolean);
      await updateAsset(asset.id, {
        name: name.trim(),
        description: description.trim(),
        tags: parsedTags,
      });
      onUpdated();
    } catch (err: any) {
      setError(err.message);
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this asset? This cannot be undone.')) return;
    setIsDeleting(true);
    try {
      await deleteAsset(asset.id);
      onDeleted();
    } catch (err: any) {
      setError(err.message);
      setIsDeleting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(asset.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const inputClass =
    'w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-glass-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-glass-border">
          <h3 className="text-sm font-semibold text-white">Asset Details</h3>
          <button onClick={onClose} className="text-text-muted hover:text-white text-lg leading-none">
            &times;
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Preview */}
          <div className="rounded-lg overflow-hidden border border-glass-border bg-glass">
            <img
              src={asset.url}
              alt={asset.name}
              className="w-full h-48 object-contain"
            />
          </div>

          {/* URL + copy */}
          <div>
            <label className="block text-xs text-text-muted mb-1">URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={asset.url}
                readOnly
                className={`${inputClass} flex-1 text-text-muted`}
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 bg-glass border border-glass-border rounded-lg text-xs text-text-muted hover:text-white transition-colors whitespace-nowrap"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Meta info */}
          <div className="flex gap-4 text-xs text-text-muted">
            <span>{asset.contentType || 'Unknown type'}</span>
            <span>{formatSize(asset.fileSize)}</span>
            <span>{asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : ''}</span>
          </div>

          {/* Editable fields */}
          <div>
            <label className="block text-xs text-text-muted mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={`${inputClass} resize-y`}
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>

          {/* Usage section */}
          <div className="pt-3 border-t border-glass-border">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
              Used In
            </h4>
            {usage === null ? (
              <p className="text-xs text-text-muted">Loading...</p>
            ) : usage.length === 0 ? (
              <p className="text-xs text-text-muted">Not used in any campaigns or journeys.</p>
            ) : (
              <ul className="space-y-1">
                {usage.map((u, i) => (
                  <li key={i} className="text-xs text-white flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      u.type === 'campaign' ? 'bg-primary/20 text-primary' : 'bg-violet-500/20 text-violet-400'
                    }`}>
                      {u.type}
                    </span>
                    {u.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Delete */}
          <div className="pt-3 border-t border-glass-border">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full px-3 py-2 bg-danger/10 border border-danger/30 text-danger rounded-lg text-sm hover:bg-danger/20 transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete Asset'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
