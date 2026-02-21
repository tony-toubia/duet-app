'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

interface SplitPath {
  id: string;
  label: string;
  percentage: number;
}

export function RandomSplitNode({ data, selected }: NodeProps) {
  const d = data as any;
  const paths: SplitPath[] = d.paths || [
    { id: 'split_0', label: 'Path A', percentage: 50 },
    { id: 'split_1', label: 'Path B', percentage: 50 },
  ];

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 min-w-[180px] text-center ${
        selected
          ? 'border-violet-400 bg-violet-500/20'
          : 'border-violet-400/50 bg-violet-500/10'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-violet-400 !w-3 !h-3 !border-2 !border-surface"
      />
      <div className="text-[10px] uppercase tracking-wider text-violet-400 font-semibold mb-1">
        Random Split
      </div>
      <div className="text-sm text-white font-medium">
        {paths.length} paths
      </div>
      <div className="flex justify-around mt-2 text-[10px] text-text-muted px-1 gap-1">
        {paths.map((p) => (
          <span key={p.id} className="truncate">
            {p.label} ({p.percentage}%)
          </span>
        ))}
      </div>
      {paths.map((p, i) => (
        <Handle
          key={p.id}
          type="source"
          position={Position.Bottom}
          id={p.id}
          className="!bg-violet-400 !w-3 !h-3 !border-2 !border-surface"
          style={{ left: `${((i + 1) / (paths.length + 1)) * 100}%` }}
        />
      ))}
    </div>
  );
}
