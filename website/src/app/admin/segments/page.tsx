'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/hooks/useAdminStore';
import { Spinner } from '@/components/ui/Spinner';

export default function SegmentsPage() {
  const router = useRouter();
  const {
    segments,
    isLoadingSegments,
    isRefreshingSegments,
    loadSegments,
    refreshSegments,
    deleteCustomSegment,
  } = useAdminStore();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadSegments();
  }, [loadSegments]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete custom segment "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await deleteCustomSegment(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Segments</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/admin/segments/new')}
            className="px-4 py-2 bg-success text-white rounded-lg text-sm font-medium hover:bg-success/80 transition-colors"
          >
            + New Segment
          </button>
          <button
            onClick={refreshSegments}
            disabled={isRefreshingSegments}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isRefreshingSegments ? (
              <>
                <Spinner size="sm" />
                Refreshing...
              </>
            ) : (
              'Refresh All'
            )}
          </button>
        </div>
      </div>

      {isLoadingSegments && segments.length === 0 ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : segments.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-text-muted mb-4">No segments computed yet.</p>
          <button
            onClick={refreshSegments}
            disabled={isRefreshingSegments}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm"
          >
            Compute Segments
          </button>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-glass-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-glass-border">
                <th className="text-left text-xs text-text-muted uppercase tracking-wide px-4 py-3">
                  Segment
                </th>
                <th className="text-left text-xs text-text-muted uppercase tracking-wide px-4 py-3">
                  Description
                </th>
                <th className="text-right text-xs text-text-muted uppercase tracking-wide px-4 py-3">
                  Members
                </th>
                <th className="text-right text-xs text-text-muted uppercase tracking-wide px-4 py-3">
                  Last Computed
                </th>
                <th className="text-right text-xs text-text-muted uppercase tracking-wide px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {segments.map((seg: any) => (
                <tr key={seg.id} className="border-b border-glass-border/50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{seg.name}</span>
                      {seg.isCustom && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/20 text-primary">
                          Custom
                        </span>
                      )}
                    </div>
                    <span className="block text-xs text-text-muted font-mono">{seg.id}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-lobby-warm/70">{seg.description}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-mono text-white">{seg.memberCount}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-text-muted">
                    {seg.lastComputedAt
                      ? new Date(seg.lastComputedAt).toLocaleString()
                      : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {seg.isCustom && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => router.push(`/admin/segments/${seg.id}`)}
                          className="text-xs text-primary hover:text-primary-light transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(seg.id, seg.name)}
                          disabled={deletingId === seg.id}
                          className="text-xs text-danger hover:text-danger/80 transition-colors disabled:opacity-50"
                        >
                          {deletingId === seg.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
