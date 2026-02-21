'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  fetchJourney,
  updateJourney,
  deleteJourney,
  fetchJourneyStats,
} from '@/services/AdminService';
import { Spinner } from '@/components/ui/Spinner';
import type { Node, Edge } from '@xyflow/react';

const FlowCanvas = dynamic(
  () => import('@/components/admin/flow/FlowCanvas').then((m) => m.FlowCanvas),
  { ssr: false }
);

export default function EditJourneyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [journey, setJourney] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('user_created');

  useEffect(() => {
    (async () => {
      try {
        const [data, statsData] = await Promise.all([
          fetchJourney(id),
          fetchJourneyStats(id).catch(() => null),
        ]);
        setJourney(data);
        setName(data.name || '');
        setTrigger(data.trigger || 'user_created');
        setStats(statsData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id]);

  const handleSave = async (nodes: Node[], edges: Edge[]) => {
    if (!name.trim()) {
      setError('Journey name is required');
      return;
    }

    const updatedNodes = nodes.map((n) =>
      n.type === 'trigger' ? { ...n, data: { ...n.data, triggerType: trigger } } : n
    );

    setIsSaving(true);
    setError(null);
    try {
      await updateJourney(id, {
        name: name.trim(),
        trigger,
        flow: {
          nodes: updatedNodes.map((n) => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: n.data,
          })),
          edges: edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle || undefined,
          })),
        },
      });
      setJourney((prev: any) => ({ ...prev, name: name.trim(), trigger }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      await updateJourney(id, { enabled: !journey.enabled });
      setJourney((prev: any) => ({ ...prev, enabled: !prev.enabled }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this journey? This cannot be undone.')) return;
    setIsDeleting(true);
    try {
      await deleteJourney(id);
      router.push('/admin/journeys');
    } catch (err: any) {
      setError(err.message);
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!journey || !journey.flow) {
    return (
      <div className="text-center py-20">
        <p className="text-text-muted mb-4">
          {journey ? 'This is a legacy journey and cannot be edited visually.' : 'Journey not found.'}
        </p>
        <button
          onClick={() => router.push('/admin/journeys')}
          className="text-primary text-sm hover:underline"
        >
          Back to Journeys
        </button>
      </div>
    );
  }

  // Convert stored flow to React Flow format
  const initialNodes: Node[] = (journey.flow.nodes || []).map((n: any) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
  }));
  const initialEdges: Edge[] = (journey.flow.edges || []).map((e: any) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle || undefined,
    animated: true,
  }));

  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-glass-border flex-shrink-0">
        <button
          onClick={() => router.push('/admin/journeys')}
          className="text-text-muted hover:text-white text-sm"
        >
          &larr; Back
        </button>

        <div className="flex-1 flex items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3 py-1.5 bg-glass border border-glass-border rounded-lg text-white text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary w-64"
          />
          <select
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            className="px-3 py-1.5 bg-glass border border-glass-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
          >
            <option value="user_created">Trigger: New user sign-up</option>
            <option value="room_created">Trigger: First room created</option>
            <option value="manual">Trigger: Manual enrollment</option>
          </select>

          {/* Toggle */}
          <button
            onClick={handleToggle}
            disabled={isToggling}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              journey.enabled
                ? 'bg-success/20 text-success border border-success/30'
                : 'bg-text-muted/20 text-text-muted border border-glass-border'
            }`}
          >
            {journey.enabled ? 'Active' : 'Paused'}
          </button>

          {/* Stats */}
          {stats && (
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span>{stats.enrolled} enrolled</span>
              <span>{stats.active} active</span>
              <span>{stats.completed} completed</span>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="px-3 py-1.5 bg-danger/10 border border-danger/30 text-danger rounded-lg text-xs hover:bg-danger/20 transition-colors disabled:opacity-50"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>

      {/* Flow canvas */}
      <div className="flex-1 min-h-0">
        <FlowCanvas
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          onSave={handleSave}
          isSaving={isSaving}
        />
      </div>
    </div>
  );
}
