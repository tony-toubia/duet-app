export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'is_true'
  | 'is_false'
  | 'exists'
  | 'not_exists'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'within_last_days'
  | 'more_than_days_ago';

export interface SegmentCondition {
  field: string;
  operator: ConditionOperator;
  value: string | number | boolean | null;
  value2?: number | null;
}

export interface SegmentRuleGroup {
  combinator: 'AND' | 'OR';
  conditions: SegmentCondition[];
}

export interface SegmentRuleSet {
  combinator: 'AND' | 'OR';
  groups: SegmentRuleGroup[];
}

export type FieldType = 'string' | 'boolean' | 'number' | 'timestamp' | 'enum';

export interface FieldDefinition {
  path: string;
  label: string;
  source: 'users' | 'emailState' | 'status';
  type: FieldType;
  enumValues?: string[];
}

export const SEGMENT_FIELDS: FieldDefinition[] = [
  { path: 'profile.email', label: 'Email address', source: 'users', type: 'string' },
  { path: 'profile.authProvider', label: 'Auth provider', source: 'users', type: 'enum', enumValues: ['google', 'email', 'anonymous'] },
  { path: 'profile.createdAt', label: 'Account created', source: 'users', type: 'timestamp' },
  { path: 'profile.displayName', label: 'Display name', source: 'users', type: 'string' },
  { path: 'pushToken', label: 'Push token', source: 'users', type: 'string' },
  { path: 'platform', label: 'Platform', source: 'users', type: 'enum', enumValues: ['ios', 'android'] },
  { path: 'unsubscribed', label: 'Unsubscribed', source: 'emailState', type: 'boolean' },
  { path: 'hasCreatedRoom', label: 'Has created room', source: 'emailState', type: 'boolean' },
  { path: 'welcomeSentAt', label: 'Welcome email sent', source: 'emailState', type: 'timestamp' },
  { path: 'tipsSentAt', label: 'Tips email sent', source: 'emailState', type: 'timestamp' },
  { path: 'reengagementSentAt', label: 'Re-engagement sent', source: 'emailState', type: 'timestamp' },
  { path: 'state', label: 'Online state', source: 'status', type: 'enum', enumValues: ['online', 'offline'] },
  { path: 'lastSeen', label: 'Last seen', source: 'status', type: 'timestamp' },
];

export const OPERATORS_BY_TYPE: Record<FieldType, ConditionOperator[]> = {
  string: ['equals', 'not_equals', 'contains', 'not_contains', 'exists', 'not_exists'],
  enum: ['equals', 'not_equals', 'exists', 'not_exists'],
  boolean: ['is_true', 'is_false'],
  number: ['equals', 'greater_than', 'less_than', 'between', 'exists', 'not_exists'],
  timestamp: ['within_last_days', 'more_than_days_ago', 'greater_than', 'less_than', 'exists', 'not_exists'],
};

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  contains: 'contains',
  not_contains: 'does not contain',
  is_true: 'is true',
  is_false: 'is false',
  exists: 'exists',
  not_exists: 'does not exist',
  greater_than: 'greater than',
  less_than: 'less than',
  between: 'between',
  within_last_days: 'within last N days',
  more_than_days_ago: 'more than N days ago',
};

/** Returns true if the operator needs no value input */
export function isNoValueOperator(op: ConditionOperator): boolean {
  return ['exists', 'not_exists', 'is_true', 'is_false'].includes(op);
}

/** Returns true if the operator needs a second value (between) */
export function isBetweenOperator(op: ConditionOperator): boolean {
  return op === 'between';
}

/** Returns true if the operator is a days-based operator */
export function isDaysOperator(op: ConditionOperator): boolean {
  return ['within_last_days', 'more_than_days_ago'].includes(op);
}

const FIELD_MAP = new Map(SEGMENT_FIELDS.map((f) => [f.path, f]));

export function getFieldDef(path: string): FieldDefinition | undefined {
  return FIELD_MAP.get(path);
}
