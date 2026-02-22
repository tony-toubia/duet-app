'use client';

import { useEffect, useState } from 'react';
import { fetchAssets } from '@/services/AdminService';

interface AssetPickerModalProps {
  onSelect: (url: string) => void;
  onClose: () => void;
}

export function AssetPickerModal({ onSelect, onClose }: AssetPickerModalProps) {
  const [assets, setAssets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAssets()
      .then((data) => setAssets(data.assets || []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = assets.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.name?.toLowerCase().includes(q) ||
      (a.tags || []).some((t: string) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-glass-border rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-glass-border flex-shrink-0">
          <h3 className="text-sm font-semibold text-white">Select Asset</h3>
          <button onClick={onClose} className="text-text-muted hover:text-white text-lg leading-none">
            &times;
          </button>
        </div>

        <div className="p-4 border-b border-glass-border flex-shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or tag..."
            className="w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <p className="text-sm text-text-muted text-center py-8">Loading assets...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">
              {assets.length === 0 ? 'No assets uploaded yet.' : 'No assets match your search.'}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {filtered.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => onSelect(asset.url)}
                  className="bg-glass border border-glass-border rounded-lg overflow-hidden hover:border-primary transition-colors text-left group"
                >
                  <div className="h-20 bg-surface flex items-center justify-center overflow-hidden">
                    <img
                      src={asset.url}
                      alt={asset.name}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="p-2">
                    <p className="text-xs text-white font-medium truncate">{asset.name}</p>
                    {asset.tags?.length > 0 && (
                      <p className="text-[10px] text-text-muted truncate mt-0.5">
                        {asset.tags.slice(0, 2).join(', ')}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
