'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';
import { previewSegmentRules } from '@/services/AdminService';
import {
  SEGMENT_FIELDS,
  OPERATORS_BY_TYPE,
  OPERATOR_LABELS,
  isNoValueOperator,
  isBetweenOperator,
  isDaysOperator,
  getFieldDef,
  type SegmentRuleSet,
  type SegmentRuleGroup,
  type SegmentCondition,
  type ConditionOperator,
} from '@/lib/segmentFields';

function emptyCondition(): SegmentCondition {
  const field = SEGMENT_FIELDS[0];
  const ops = OPERATORS_BY_TYPE[field.type];
  return { field: field.path, operator: ops[0], value: null };
}

function emptyGroup(): SegmentRuleGroup {
  return { combinator: 'AND', conditions: [emptyCondition()] };
}

function emptyRuleSet(): SegmentRuleSet {
  return { combinator: 'AND', groups: [emptyGroup()] };
}

interface SegmentBuilderProps {
  initialName?: string;
  initialDescription?: string;
  initialRules?: SegmentRuleSet;
  onSave: (name: string, description: string, rules: SegmentRuleSet) => Promise<void>;
  saveLabel: string;
}

export default function SegmentBuilder({
  initialName = '',
  initialDescription = '',
  initialRules,
  onSave,
  saveLabel,
}: SegmentBuilderProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [rules, setRules] = useState<SegmentRuleSet>(initialRules || emptyRuleSet());
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced preview
  const fetchPreview = useCallback(async (r: SegmentRuleSet) => {
    const hasConditions = r.groups.some((g) => g.conditions.length > 0);
    if (!hasConditions) {
      setPreviewCount(null);
      return;
    }
    setIsPreviewLoading(true);
    try {
      const { memberCount } = await previewSegmentRules(r);
      setPreviewCount(memberCount);
    } catch {
      setPreviewCount(null);
    } finally {
      setIsPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => fetchPreview(rules), 500);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [rules, fetchPreview]);

  const updateGroup = (gi: number, updater: (g: SegmentRuleGroup) => SegmentRuleGroup) => {
    setRules((prev) => ({
      ...prev,
      groups: prev.groups.map((g, i) => (i === gi ? updater(g) : g)),
    }));
  };

  const updateCondition = (gi: number, ci: number, updater: (c: SegmentCondition) => SegmentCondition) => {
    updateGroup(gi, (g) => ({
      ...g,
      conditions: g.conditions.map((c, i) => (i === ci ? updater(c) : c)),
    }));
  };

  const addGroup = () => {
    setRules((prev) => ({ ...prev, groups: [...prev.groups, emptyGroup()] }));
  };

  const removeGroup = (gi: number) => {
    setRules((prev) => ({
      ...prev,
      groups: prev.groups.filter((_, i) => i !== gi),
    }));
  };

  const addCondition = (gi: number) => {
    updateGroup(gi, (g) => ({
      ...g,
      conditions: [...g.conditions, emptyCondition()],
    }));
  };

  const removeCondition = (gi: number, ci: number) => {
    updateGroup(gi, (g) => ({
      ...g,
      conditions: g.conditions.filter((_, i) => i !== ci),
    }));
  };

  const handleFieldChange = (gi: number, ci: number, fieldPath: string) => {
    const fieldDef = getFieldDef(fieldPath);
    if (!fieldDef) return;
    const ops = OPERATORS_BY_TYPE[fieldDef.type];
    updateCondition(gi, ci, () => ({
      field: fieldPath,
      operator: ops[0],
      value: null,
      value2: undefined,
    }));
  };

  const handleOperatorChange = (gi: number, ci: number, op: ConditionOperator) => {
    updateCondition(gi, ci, (c) => ({
      ...c,
      operator: op,
      value: isNoValueOperator(op) ? null : c.value,
      value2: isBetweenOperator(op) ? (c.value2 ?? null) : undefined,
    }));
  };

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Segment name is required');
      return;
    }
    const hasConditions = rules.groups.some((g) => g.conditions.length > 0);
    if (!hasConditions) {
      setError('At least one condition is required');
      return;
    }
    setIsSaving(true);
    try {
      await onSave(name.trim(), description.trim(), rules);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const selectClass =
    'bg-glass border border-glass-border rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-primary/50 appearance-none';
  const inputClass =
    'bg-glass border border-glass-border rounded px-2 py-1.5 text-sm text-white placeholder-text-muted focus:outline-none focus:border-primary/50';

  return (
    <div>
      {/* Name + Description */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-xs text-text-muted mb-1">Segment name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Power users on iOS"
            className={`${inputClass} w-full`}
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Active iOS users who have created a room"
            className={`${inputClass} w-full`}
          />
        </div>
      </div>

      {/* Top-level combinator */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-text-muted">Match users in</span>
        <select
          value={rules.combinator}
          onChange={(e) =>
            setRules((prev) => ({ ...prev, combinator: e.target.value as 'AND' | 'OR' }))
          }
          className={selectClass}
        >
          <option value="AND">ALL</option>
          <option value="OR">ANY</option>
        </select>
        <span className="text-sm text-text-muted">of the following groups:</span>
      </div>

      {/* Groups */}
      <div className="space-y-4 mb-6">
        {rules.groups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && (
              <div className="flex items-center justify-center my-2">
                <div className="h-px bg-glass-border flex-1" />
                <span className="px-3 text-xs font-medium text-primary uppercase">
                  {rules.combinator}
                </span>
                <div className="h-px bg-glass-border flex-1" />
              </div>
            )}
            <div className="bg-surface rounded-xl border border-glass-border p-4">
              {/* Group header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted font-medium">
                    Group {gi + 1}
                  </span>
                  {group.conditions.length > 1 && (
                    <>
                      <span className="text-xs text-text-muted">— conditions combined with</span>
                      <select
                        value={group.combinator}
                        onChange={(e) =>
                          updateGroup(gi, (g) => ({
                            ...g,
                            combinator: e.target.value as 'AND' | 'OR',
                          }))
                        }
                        className={`${selectClass} text-xs`}
                      >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                      </select>
                    </>
                  )}
                </div>
                {rules.groups.length > 1 && (
                  <button
                    onClick={() => removeGroup(gi)}
                    className="text-xs text-danger hover:text-danger/80 transition-colors"
                  >
                    Remove group
                  </button>
                )}
              </div>

              {/* Conditions */}
              <div className="space-y-2">
                {group.conditions.map((cond, ci) => {
                  const fieldDef = getFieldDef(cond.field);
                  const fieldType = fieldDef?.type || 'string';
                  const operators = OPERATORS_BY_TYPE[fieldType];
                  const noValue = isNoValueOperator(cond.operator);
                  const showBetween = isBetweenOperator(cond.operator);
                  const showDays = isDaysOperator(cond.operator);

                  return (
                    <div key={ci} className="flex items-center gap-2 flex-wrap">
                      {/* Field selector */}
                      <select
                        value={cond.field}
                        onChange={(e) => handleFieldChange(gi, ci, e.target.value)}
                        className={`${selectClass} min-w-[160px]`}
                      >
                        {SEGMENT_FIELDS.map((f) => (
                          <option key={f.path} value={f.path}>
                            {f.label}
                          </option>
                        ))}
                      </select>

                      {/* Operator selector */}
                      <select
                        value={cond.operator}
                        onChange={(e) =>
                          handleOperatorChange(gi, ci, e.target.value as ConditionOperator)
                        }
                        className={`${selectClass} min-w-[140px]`}
                      >
                        {operators.map((op) => (
                          <option key={op} value={op}>
                            {OPERATOR_LABELS[op]}
                          </option>
                        ))}
                      </select>

                      {/* Value input — depends on field type and operator */}
                      {!noValue && fieldDef?.type === 'enum' && fieldDef.enumValues && (
                        <select
                          value={String(cond.value || '')}
                          onChange={(e) =>
                            updateCondition(gi, ci, (c) => ({ ...c, value: e.target.value }))
                          }
                          className={selectClass}
                        >
                          <option value="">Select...</option>
                          {fieldDef.enumValues.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      )}

                      {!noValue && fieldDef?.type === 'string' && (
                        <input
                          type="text"
                          value={String(cond.value || '')}
                          onChange={(e) =>
                            updateCondition(gi, ci, (c) => ({ ...c, value: e.target.value }))
                          }
                          placeholder="Value"
                          className={`${inputClass} w-40`}
                        />
                      )}

                      {!noValue && (fieldDef?.type === 'number' || fieldDef?.type === 'timestamp') && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={cond.value != null ? String(cond.value) : ''}
                            onChange={(e) =>
                              updateCondition(gi, ci, (c) => ({
                                ...c,
                                value: e.target.value ? Number(e.target.value) : null,
                              }))
                            }
                            placeholder={showDays ? 'Days' : 'Value'}
                            className={`${inputClass} w-24`}
                          />
                          {showDays && (
                            <span className="text-xs text-text-muted">days</span>
                          )}
                          {showBetween && (
                            <>
                              <span className="text-xs text-text-muted">and</span>
                              <input
                                type="number"
                                value={cond.value2 != null ? String(cond.value2) : ''}
                                onChange={(e) =>
                                  updateCondition(gi, ci, (c) => ({
                                    ...c,
                                    value2: e.target.value ? Number(e.target.value) : null,
                                  }))
                                }
                                placeholder="Value"
                                className={`${inputClass} w-24`}
                              />
                            </>
                          )}
                        </div>
                      )}

                      {/* Remove condition */}
                      {group.conditions.length > 1 && (
                        <button
                          onClick={() => removeCondition(gi, ci)}
                          className="text-text-muted hover:text-danger transition-colors text-lg leading-none"
                          title="Remove condition"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add condition */}
              <button
                onClick={() => addCondition(gi)}
                className="mt-3 text-xs text-primary hover:text-primary-light transition-colors"
              >
                + Add condition
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add group */}
      <button
        onClick={addGroup}
        className="mb-6 text-sm text-primary hover:text-primary-light transition-colors"
      >
        + Add group
      </button>

      {/* Preview + Actions */}
      <div className="flex items-center justify-between border-t border-glass-border pt-4">
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && <Spinner size="sm" />}
            {saveLabel}
          </button>
          <button
            onClick={() => router.push('/admin/segments')}
            className="px-4 py-2 text-text-muted text-sm hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>

        <div className="flex items-center gap-2 bg-glass rounded-lg px-4 py-2 border border-glass-border">
          <span className="text-xs text-text-muted">Matching users:</span>
          {isPreviewLoading ? (
            <Spinner size="sm" />
          ) : previewCount !== null ? (
            <span className="text-sm font-mono font-medium text-white">{previewCount}</span>
          ) : (
            <span className="text-sm text-text-muted">—</span>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-danger/10 border border-danger/30 rounded-lg p-3">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}
    </div>
  );
}
