'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

export function ActionNode({ data, selected }: NodeProps) {
  const d = data as any;
  const isEmail = d.channel === 'email';
  const label = d.customTitle || d.customSubject || d.templateId || 'Configure...';

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 min-w-[180px] text-center ${
        selected
          ? 'border-primary bg-primary/20'
          : 'border-primary/50 bg-primary/10'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-primary !w-3 !h-3 !border-2 !border-surface"
      />
      <div className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1">
        {isEmail ? 'Send Email' : 'Send Push'}
      </div>
      <div className="text-sm text-white font-medium truncate max-w-[200px]">
        {label}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-primary !w-3 !h-3 !border-2 !border-surface"
      />
    </div>
  );
}
