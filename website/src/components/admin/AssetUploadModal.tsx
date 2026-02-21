'use client';

import { useState, useRef } from 'react';
import { storageService } from '@/services/StorageService';
import { createAsset } from '@/services/AdminService';

interface AssetUploadModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function AssetUploadModal({ onClose, onCreated }: AssetUploadModalProps) {
  const [tab, setTab] = useState<'upload' | 'url'>('upload');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '));
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleUrlBlur = () => {
    if (url && url.startsWith('http')) {
      setPreview(url);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      let assetUrl = url;
      let contentType = 'image/unknown';
      let fileSize = 0;

      if (tab === 'upload') {
        if (!file) {
          setError('Please select a file');
          setIsSaving(false);
          return;
        }
        const result = await storageService.uploadAsset(file);
        assetUrl = result.url;
        contentType = result.contentType;
        fileSize = result.fileSize;
      } else {
        if (!url.trim()) {
          setError('Please enter a URL');
          setIsSaving(false);
          return;
        }
      }

      const parsedTags = tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      await createAsset({
        name: name.trim(),
        url: assetUrl,
        tags: parsedTags,
        description: description.trim(),
        contentType,
        fileSize,
      });

      onCreated();
    } catch (err: any) {
      setError(err.message);
      setIsSaving(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-glass-border rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-glass-border">
          <h3 className="text-sm font-semibold text-white">Upload Asset</h3>
          <button onClick={onClose} className="text-text-muted hover:text-white text-lg leading-none">
            &times;
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Tab selector */}
          <div className="flex gap-2">
            {(['upload', 'url'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setPreview(null); setFile(null); setUrl(''); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === t
                    ? 'bg-primary text-white'
                    : 'bg-glass border border-glass-border text-text-muted'
                }`}
              >
                {t === 'upload' ? 'Upload File' : 'From URL'}
              </button>
            ))}
          </div>

          {/* File upload */}
          {tab === 'upload' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-3 py-6 border-2 border-dashed border-glass-border rounded-lg text-text-muted text-sm hover:border-primary hover:text-white transition-colors"
              >
                {file ? file.name : 'Click to select image...'}
              </button>
            </div>
          )}

          {/* URL input */}
          {tab === 'url' && (
            <div>
              <label className="block text-xs text-text-muted mb-1">Image URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={handleUrlBlur}
                placeholder="https://example.com/image.png"
                className={inputClass}
              />
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="rounded-lg overflow-hidden border border-glass-border bg-glass">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-40 object-contain"
                onError={() => setPreview(null)}
              />
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs text-text-muted mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Asset name"
              className={inputClass}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-text-muted mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description"
              className={`${inputClass} resize-y`}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs text-text-muted mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="welcome, push, hero"
              className={inputClass}
            />
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Asset'}
          </button>
        </div>
      </div>
    </div>
  );
}
