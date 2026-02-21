'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

export function ExitNode({ selected }: NodeProps) {
  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 min-w-[120px] text-center ${
        selected
          ? 'border-danger bg-danger/20'
          : 'border-danger/50 bg-danger/10'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-danger !w-3 !h-3 !border-2 !border-surface"
      />
      <div className="text-[10px] uppercase tracking-wider text-danger font-semibold mb-1">
        Exit
      </div>
      <div className="text-sm text-white font-medium">End journey</div>
    </div>
  );
}
