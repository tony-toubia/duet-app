'use client';

import { useEffect, useState } from 'react';
import { fetchAssets } from '@/services/AdminService';
import { Spinner } from '@/components/ui/Spinner';
import { AssetUploadModal } from '@/components/admin/AssetUploadModal';
import { AssetDetailModal } from '@/components/admin/AssetDetailModal';

export default function AssetsPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);

  const loadAssets = async () => {
    try {
      const data = await fetchAssets();
      setAssets(data.assets || []);
    } catch (err) {
      console.error('Failed to load assets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const filtered = assets.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.name?.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q) ||
      (a.tags || []).some((t: string) => t.toLowerCase().includes(q))
    );
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Assets</h1>
        <button
          onClick={() => setShowUpload(true)}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors"
        >
          Upload Asset
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, tag, or description..."
          className="w-full max-w-sm px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-text-muted mb-2">
            {assets.length === 0 ? 'No assets yet.' : 'No assets match your search.'}
          </p>
          {assets.length === 0 && (
            <button
              onClick={() => setShowUpload(true)}
              className="text-primary text-sm hover:underline"
            >
              Upload your first asset
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map((asset) => (
            <button
              key={asset.id}
              onClick={() => setSelectedAsset(asset)}
              className="bg-glass border border-glass-border rounded-xl overflow-hidden hover:border-primary transition-colors text-left group"
            >
              <div className="h-32 bg-surface flex items-center justify-center overflow-hidden">
                <img
                  src={asset.url}
                  alt={asset.name}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="p-3">
                <p className="text-sm text-white font-medium truncate">{asset.name}</p>
                {asset.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {asset.tags.slice(0, 3).map((tag: string) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 bg-glass-border rounded text-[10px] text-text-muted"
                      >
                        {tag}
                      </span>
                    ))}
                    {asset.tags.length > 3 && (
                      <span className="text-[10px] text-text-muted">+{asset.tags.length - 3}</span>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-text-muted mt-1">
                  {asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <AssetUploadModal
          onClose={() => setShowUpload(false)}
          onCreated={() => {
            setShowUpload(false);
            loadAssets();
          }}
        />
      )}

      {/* Detail modal */}
      {selectedAsset && (
        <AssetDetailModal
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onUpdated={() => {
            setSelectedAsset(null);
            loadAssets();
          }}
          onDeleted={() => {
            setSelectedAsset(null);
            loadAssets();
          }}
        />
      )}
    </div>
  );
}
