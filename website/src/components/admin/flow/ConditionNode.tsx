'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

const EVENT_LABELS: Record<string, string> = {
  push_received: 'Push received',
  push_opened: 'Push opened',
  email_sent: 'Email sent',
  room_created: 'Room created',
  room_joined: 'Room joined',
  login: 'Logged in',
  signup: 'Signed up',
  profile_updated: 'Profile updated',
  ad_viewed: 'Ad viewed',
  session_start: 'Session started',
};

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as any;

  let label = 'Configure...';
  if (d.conditionType === 'event_occurred' && d.eventType) {
    label = EVENT_LABELS[d.eventType] || d.eventType;
    if (d.sinceTrigger) label += ' (since entry)';
  } else if (d.conditionType === 'user_property' && d.field) {
    label = `${d.field} ${d.operator || '?'} ${d.value ?? ''}`;
  } else if (d.conditionType === 'time_elapsed' && d.elapsedMs) {
    label = `${formatDelay(d.elapsedMs)} elapsed`;
  }

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 min-w-[180px] text-center ${
        selected
          ? 'border-warning bg-warning/20'
          : 'border-warning/50 bg-warning/10'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-warning !w-3 !h-3 !border-2 !border-surface"
      />
      <div className="text-[10px] uppercase tracking-wider text-warning font-semibold mb-1">
        Condition
      </div>
      <div className="text-sm text-white font-medium truncate max-w-[200px]">
        {label}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-text-muted px-2">
        <span>Yes</span>
        <span>No</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        className="!bg-success !w-3 !h-3 !border-2 !border-surface"
        style={{ left: '30%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        className="!bg-danger !w-3 !h-3 !border-2 !border-surface"
        style={{ left: '70%' }}
      />
    </div>
  );
}

function formatDelay(ms: number): string {
  const hours = ms / (60 * 60 * 1000);
  if (hours < 1) return `${Math.round(ms / 60000)}m`;
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
