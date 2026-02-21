'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

const TRIGGER_LABELS: Record<string, string> = {
  user_created: 'New user sign-up',
  room_created: 'First room created',
  manual: 'Manual enrollment',
};

export function TriggerNode({ data, selected }: NodeProps) {
  const d = data as any;
  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 min-w-[180px] text-center ${
        selected
          ? 'border-success bg-success/20'
          : 'border-success/50 bg-success/10'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-success font-semibold mb-1">
        Trigger
      </div>
      <div className="text-sm text-white font-medium">
        {TRIGGER_LABELS[d.triggerType] || d.triggerType || 'Select trigger'}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-success !w-3 !h-3 !border-2 !border-surface"
      />
    </div>
  );
}
