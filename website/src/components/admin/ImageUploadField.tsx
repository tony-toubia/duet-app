'use client';

import { useRef, useState } from 'react';
import { storageService } from '@/services/StorageService';
import { createAsset } from '@/services/AdminService';
import { AssetPickerModal } from '@/components/admin/AssetPickerModal';

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  optional?: boolean;
}

export function ImageUploadField({ value, onChange, label = 'Image URL', optional = true }: ImageUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const result = await storageService.uploadAsset(file);
      onChange(result.url);
      // Auto-save to asset library
      createAsset({
        name: file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '),
        url: result.url,
        tags: ['message'],
        contentType: result.contentType,
        fileSize: result.fileSize,
      }).catch(() => {});
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const inputClass =
    'w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary';

  return (
    <div>
      <label className="block text-sm text-text-muted mb-1">
        {label} {optional && <span className="opacity-50">(optional)</span>}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/image.png"
          className={`flex-1 ${inputClass}`}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="px-3 py-2 bg-glass border border-glass-border rounded-lg text-xs text-text-muted hover:text-white hover:bg-glass-border transition-colors whitespace-nowrap disabled:opacity-50"
        >
          {isUploading ? 'Uploading...' : 'Upload'}
        </button>
        <button
          type="button"
          onClick={() => setShowAssetPicker(true)}
          className="px-3 py-2 bg-glass border border-glass-border rounded-lg text-xs text-text-muted hover:text-white hover:bg-glass-border transition-colors whitespace-nowrap"
        >
          Browse
        </button>
      </div>
      {value && value.startsWith('http') && (
        <div className="mt-2 rounded-lg overflow-hidden border border-glass-border bg-glass inline-block">
          <img src={value} alt="" className="max-h-20 object-contain" onError={() => {}} />
        </div>
      )}
      {uploadError && <p className="text-xs text-danger mt-1">{uploadError}</p>}

      {showAssetPicker && (
        <AssetPickerModal
          onSelect={(url) => { onChange(url); setShowAssetPicker(false); }}
          onClose={() => setShowAssetPicker(false)}
        />
      )}
    </div>
  );
}
