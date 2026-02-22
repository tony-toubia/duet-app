'use client';

import { useState } from 'react';
import type { Node } from '@xyflow/react';
import { AssetPickerModal } from '@/components/admin/AssetPickerModal';

const TRACKABLE_EVENTS = [
  { value: 'push_received', label: 'Push received' },
  { value: 'push_opened', label: 'Push opened' },
  { value: 'email_sent', label: 'Email sent' },
  { value: 'room_created', label: 'Room created' },
  { value: 'room_joined', label: 'Room joined' },
  { value: 'login', label: 'Logged in' },
  { value: 'signup', label: 'Signed up' },
  { value: 'profile_updated', label: 'Profile updated' },
  { value: 'ad_viewed', label: 'Ad viewed' },
  { value: 'session_start', label: 'Session started' },
];

const EMAIL_TEMPLATES = [
  { value: 'welcome', label: 'Welcome' },
  { value: 'tips', label: 'Tips & tricks' },
  { value: 'reengagement', label: 'Re-engagement' },
  { value: 'custom', label: 'Custom content' },
];

const PUSH_TEMPLATES = [
  { value: 'welcome_push', label: 'Welcome push' },
  { value: 'custom', label: 'Custom content' },
];

const DELAY_PRESETS = [
  { value: 3600000, label: '1 hour' },
  { value: 21600000, label: '6 hours' },
  { value: 43200000, label: '12 hours' },
  { value: 86400000, label: '1 day' },
  { value: 172800000, label: '2 days' },
  { value: 259200000, label: '3 days' },
  { value: 604800000, label: '7 days' },
  { value: 1209600000, label: '14 days' },
  { value: 2592000000, label: '30 days' },
];

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'is_true', label: 'is true' },
  { value: 'is_false', label: 'is false' },
  { value: 'exists', label: 'exists' },
  { value: 'not_exists', label: 'does not exist' },
  { value: 'contains', label: 'contains' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
];

const USER_FIELDS = [
  { value: 'profile.email', label: 'Email address' },
  { value: 'profile.authProvider', label: 'Auth provider' },
  { value: 'profile.displayName', label: 'Display name' },
  { value: 'pushToken', label: 'Push token' },
  { value: 'platform', label: 'Platform' },
  { value: 'preferences.emailOptIn', label: 'Email opt-in' },
  { value: 'preferences.pushOptIn', label: 'Push opt-in' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
  { value: 'hasCreatedRoom', label: 'Has created room' },
];

interface NodeEditorProps {
  node: Node;
  onChange: (nodeId: string, data: any) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

const inputClass =
  'w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary';
const labelClass = 'block text-xs text-text-muted mb-1';

export function NodeEditor({ node, onChange, onDelete, onClose }: NodeEditorProps) {
  const d = node.data as any;
  const [showAssetPicker, setShowAssetPicker] = useState(false);

  const update = (patch: Record<string, any>) => {
    onChange(node.id, { ...d, ...patch });
  };

  return (
    <div className="w-80 bg-surface border-l border-glass-border h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white capitalize">
          {node.type} Node
        </h3>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-white text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {/* Trigger node */}
      {node.type === 'trigger' && (
        <div>
          <label className={labelClass}>Trigger Type</label>
          <select
            value={d.triggerType || 'user_created'}
            onChange={(e) => update({ triggerType: e.target.value })}
            className={inputClass}
          >
            <option value="user_created">New user sign-up</option>
            <option value="room_created">First room created</option>
            <option value="manual">Manual enrollment</option>
          </select>
        </div>
      )}

      {/* Action node */}
      {node.type === 'action' && (
        <>
          <div>
            <label className={labelClass}>Channel</label>
            <div className="flex gap-2">
              {['email', 'push'].map((ch) => (
                <button
                  key={ch}
                  onClick={() => update({ channel: ch, templateId: '', customSubject: '', customBody: '', customTitle: '' })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    d.channel === ch
                      ? 'bg-primary text-white'
                      : 'bg-glass border border-glass-border text-text-muted'
                  }`}
                >
                  {ch === 'email' ? 'Email' : 'Push'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Template</label>
            <select
              value={d.templateId || ''}
              onChange={(e) => update({ templateId: e.target.value })}
              className={inputClass}
            >
              <option value="">Select...</option>
              {(d.channel === 'email' ? EMAIL_TEMPLATES : PUSH_TEMPLATES).map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {d.templateId === 'custom' && d.channel === 'email' && (
            <>
              <div>
                <label className={labelClass}>Subject</label>
                <input
                  type="text"
                  value={d.customSubject || ''}
                  onChange={(e) => update({ customSubject: e.target.value })}
                  placeholder="Email subject"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Body (HTML)</label>
                <textarea
                  value={d.customBody || ''}
                  onChange={(e) => update({ customBody: e.target.value })}
                  rows={6}
                  placeholder="<p>Hello {{name}}!</p>"
                  className={`${inputClass} font-mono resize-y`}
                />
              </div>
            </>
          )}

          {d.templateId === 'custom' && d.channel === 'push' && (
            <>
              <div>
                <label className={labelClass}>Title</label>
                <input
                  type="text"
                  value={d.customTitle || ''}
                  onChange={(e) => update({ customTitle: e.target.value })}
                  placeholder="Notification title"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Body</label>
                <textarea
                  value={d.customBody || ''}
                  onChange={(e) => update({ customBody: e.target.value })}
                  rows={3}
                  placeholder="Notification message"
                  className={`${inputClass} resize-y`}
                />
              </div>
              <div>
                <label className={labelClass}>Image URL (optional)</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={d.pushImageUrl || ''}
                    onChange={(e) => update({ pushImageUrl: e.target.value })}
                    placeholder="https://example.com/image.png"
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAssetPicker(true)}
                    className="px-2 py-2 bg-glass border border-glass-border rounded-lg text-[10px] text-text-muted hover:text-white hover:bg-glass-border transition-colors whitespace-nowrap"
                  >
                    Browse
                  </button>
                </div>
              </div>
              <div>
                <label className={labelClass}>Action URL (optional)</label>
                <input
                  type="text"
                  value={d.pushActionUrl || ''}
                  onChange={(e) => update({ pushActionUrl: e.target.value })}
                  placeholder="https://getduet.app"
                  className={inputClass}
                />
              </div>
            </>
          )}
        </>
      )}

      {/* Condition node */}
      {node.type === 'condition' && (
        <>
          <div>
            <label className={labelClass}>Condition Type</label>
            <select
              value={d.conditionType || 'event_occurred'}
              onChange={(e) => update({ conditionType: e.target.value })}
              className={inputClass}
            >
              <option value="event_occurred">Event occurred</option>
              <option value="user_property">User property</option>
            </select>
          </div>

          {d.conditionType === 'event_occurred' && (
            <>
              <div>
                <label className={labelClass}>Event</label>
                <select
                  value={d.eventType || ''}
                  onChange={(e) => update({ eventType: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select event...</option>
                  {TRACKABLE_EVENTS.map((ev) => (
                    <option key={ev.value} value={ev.value}>
                      {ev.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={d.sinceTrigger ?? true}
                  onChange={(e) => update({ sinceTrigger: e.target.checked })}
                  className="rounded"
                />
                <span className="text-xs text-text-muted">
                  Since journey entry only
                </span>
              </label>
            </>
          )}

          {d.conditionType === 'user_property' && (
            <>
              <div>
                <label className={labelClass}>Field</label>
                <select
                  value={d.field || ''}
                  onChange={(e) => update({ field: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select field...</option>
                  {USER_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Operator</label>
                <select
                  value={d.operator || 'exists'}
                  onChange={(e) => update({ operator: e.target.value })}
                  className={inputClass}
                >
                  {CONDITION_OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </div>
              {!['is_true', 'is_false', 'exists', 'not_exists'].includes(d.operator) && (
                <div>
                  <label className={labelClass}>Value</label>
                  <input
                    type="text"
                    value={d.value ?? ''}
                    onChange={(e) => update({ value: e.target.value })}
                    placeholder="Compare value"
                    className={inputClass}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Delay node */}
      {node.type === 'delay' && (
        <div>
          <label className={labelClass}>Wait Duration</label>
          <select
            value={d.delayMs || 0}
            onChange={(e) => update({ delayMs: Number(e.target.value) })}
            className={inputClass}
          >
            <option value={0}>Select...</option>
            {DELAY_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Random Split node */}
      {node.type === 'randomSplit' && (() => {
        const paths: { id: string; label: string; percentage: number }[] = d.paths || [];
        const isEvenSplit = d.evenSplit !== false; // default true

        const setEvenSplit = (even: boolean) => {
          if (even) {
            const pct = Math.floor(100 / paths.length);
            const remainder = 100 - pct * paths.length;
            const updated = paths.map((p: any, i: number) => ({
              ...p,
              percentage: pct + (i < remainder ? 1 : 0),
            }));
            update({ evenSplit: true, paths: updated });
          } else {
            update({ evenSplit: false });
          }
        };

        const addPath = () => {
          if (paths.length >= 10) return;
          const idx = paths.length;
          const newPath = { id: `split_${idx}`, label: `Path ${String.fromCharCode(65 + idx)}`, percentage: 0 };
          const newPaths = [...paths, newPath];
          if (isEvenSplit) {
            const pct = Math.floor(100 / newPaths.length);
            const remainder = 100 - pct * newPaths.length;
            const balanced = newPaths.map((p, i) => ({ ...p, percentage: pct + (i < remainder ? 1 : 0) }));
            update({ paths: balanced });
          } else {
            update({ paths: newPaths });
          }
        };

        const removePath = (idx: number) => {
          if (paths.length <= 2) return;
          const removedId = paths[idx].id;
          const newPaths = paths.filter((_: any, i: number) => i !== idx);
          if (isEvenSplit) {
            const pct = Math.floor(100 / newPaths.length);
            const remainder = 100 - pct * newPaths.length;
            const balanced = newPaths.map((p: any, i: number) => ({ ...p, percentage: pct + (i < remainder ? 1 : 0) }));
            update({ paths: balanced, _removedHandles: [removedId] });
          } else {
            update({ paths: newPaths, _removedHandles: [removedId] });
          }
        };

        const updatePathLabel = (idx: number, label: string) => {
          const updated = paths.map((p: any, i: number) => i === idx ? { ...p, label } : p);
          update({ paths: updated });
        };

        const updatePathPercentage = (idx: number, pct: number) => {
          const updated = paths.map((p: any, i: number) => i === idx ? { ...p, percentage: pct } : p);
          update({ paths: updated });
        };

        const total = paths.reduce((s: number, p: any) => s + p.percentage, 0);

        return (
          <>
            <div>
              <label className={labelClass}>Paths ({paths.length})</label>
              <div className="flex items-center gap-2 mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEvenSplit}
                    onChange={(e) => setEvenSplit(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-xs text-text-muted">Even split</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              {paths.map((p: any, i: number) => (
                <div key={p.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={p.label}
                    onChange={(e) => updatePathLabel(i, e.target.value)}
                    className="flex-1 px-2 py-1.5 bg-glass border border-glass-border rounded-lg text-white text-xs focus:outline-none focus:border-primary"
                    placeholder={`Path ${String.fromCharCode(65 + i)}`}
                  />
                  {isEvenSplit ? (
                    <span className="text-xs text-text-muted w-12 text-right">{p.percentage}%</span>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={p.percentage}
                      onChange={(e) => updatePathPercentage(i, Number(e.target.value))}
                      className="w-16 px-2 py-1.5 bg-glass border border-glass-border rounded-lg text-white text-xs text-right focus:outline-none focus:border-primary"
                    />
                  )}
                  {paths.length > 2 && (
                    <button
                      onClick={() => removePath(i)}
                      className="text-danger text-sm hover:text-danger/80 leading-none"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>

            {!isEvenSplit && total !== 100 && (
              <p className="text-xs text-danger">
                Percentages must add up to 100% (currently {total}%)
              </p>
            )}

            {paths.length < 10 && (
              <button
                onClick={addPath}
                className="w-full px-3 py-1.5 bg-glass border border-glass-border text-text-muted rounded-lg text-xs hover:text-white hover:bg-glass-border transition-colors"
              >
                + Add Path
              </button>
            )}
          </>
        );
      })()}

      {/* Exit node — no config needed */}
      {node.type === 'exit' && (
        <p className="text-xs text-text-muted">
          Users reaching this node will complete the journey. No configuration needed.
        </p>
      )}

      {/* Delete button (not for trigger nodes) */}
      {node.type !== 'trigger' && (
        <div className="pt-4 border-t border-glass-border">
          <button
            onClick={() => onDelete(node.id)}
            className="w-full px-3 py-2 bg-danger/10 border border-danger/30 text-danger rounded-lg text-sm hover:bg-danger/20 transition-colors"
          >
            Delete Node
          </button>
        </div>
      )}

      {showAssetPicker && (
        <AssetPickerModal
          onSelect={(url) => { update({ pushImageUrl: url }); setShowAssetPicker(false); }}
          onClose={() => setShowAssetPicker(false)}
        />
      )}
    </div>
  );
}
