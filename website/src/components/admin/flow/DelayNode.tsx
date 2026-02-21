'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

const DELAY_PRESETS: Record<number, string> = {
  3600000: '1 hour',
  7200000: '2 hours',
  21600000: '6 hours',
  43200000: '12 hours',
  86400000: '1 day',
  172800000: '2 days',
  259200000: '3 days',
  604800000: '7 days',
  1209600000: '14 days',
  2592000000: '30 days',
};

export function DelayNode({ data, selected }: NodeProps) {
  const d = data as any;
  const delayMs = d.delayMs || 0;
  const label = DELAY_PRESETS[delayMs] || formatDelay(delayMs);

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 min-w-[180px] text-center ${
        selected
          ? 'border-text-muted bg-text-muted/20'
          : 'border-text-muted/50 bg-text-muted/10'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-text-muted !w-3 !h-3 !border-2 !border-surface"
      />
      <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">
        Wait
      </div>
      <div className="text-sm text-white font-medium">
        {delayMs > 0 ? label : 'Set duration...'}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-text-muted !w-3 !h-3 !border-2 !border-surface"
      />
    </div>
  );
}

function formatDelay(ms: number): string {
  if (ms === 0) return 'Immediately';
  const hours = ms / (60 * 60 * 1000);
  if (hours < 1) return `${Math.round(ms / 60000)} min`;
  if (hours < 24) return `${hours} hours`;
  const days = Math.round(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''}`;
}
