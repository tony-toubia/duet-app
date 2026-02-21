'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createJourney } from '@/services/AdminService';
import type { Node, Edge } from '@xyflow/react';

const FlowCanvas = dynamic(
  () => import('@/components/admin/flow/FlowCanvas').then((m) => m.FlowCanvas),
  { ssr: false }
);

const DEFAULT_NODES: Node[] = [
  {
    id: 'trigger_1',
    type: 'trigger',
    position: { x: 250, y: 50 },
    data: { triggerType: 'user_created' },
  },
  {
    id: 'exit_1',
    type: 'exit',
    position: { x: 250, y: 200 },
    data: {},
  },
];

const DEFAULT_EDGES: Edge[] = [
  { id: 'e_init', source: 'trigger_1', target: 'exit_1', animated: true },
];

export default function NewJourneyPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('user_created');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (nodes: Node[], edges: Edge[]) => {
    if (!name.trim()) {
      setError('Journey name is required');
      return;
    }

    // Update trigger node data to match selected trigger
    const updatedNodes = nodes.map((n) =>
      n.type === 'trigger' ? { ...n, data: { ...n.data, triggerType: trigger } } : n
    );

    setIsSaving(true);
    setError(null);
    try {
      const result = await createJourney({
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
      router.push(`/admin/journeys/${result.id}`);
    } catch (err: any) {
      setError(err.message);
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-glass-border flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="text-text-muted hover:text-white text-sm"
        >
          &larr; Back
        </button>
        <div className="flex-1 flex items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Journey name..."
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
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      {/* Flow canvas */}
      <div className="flex-1 min-h-0">
        <FlowCanvas
          initialNodes={DEFAULT_NODES}
          initialEdges={DEFAULT_EDGES}
          onSave={handleSave}
          isSaving={isSaving}
        />
      </div>
    </div>
  );
}
