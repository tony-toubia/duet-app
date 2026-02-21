export interface Campaign {
  name: string;
  channels: ('email' | 'push')[];
  segmentId: string;
  status: 'draft' | 'queued' | 'sending' | 'sent' | 'failed';
  email: {
    subject: string;
    body: string;
    includeUnsub: boolean;
  } | null;
  push: {
    title: string;
    body: string;
    imageUrl: string | null;
    actionUrl: string | null;
    data: Record<string, string> | null;
  } | null;
  createdAt: number;
  updatedAt: number;
  sentAt: number | null;
  results: {
    totalTargeted: number;
    emailsSent: number;
    emailsFailed: number;
    pushSent: number;
    pushFailed: number;
  } | null;
}

export interface Segment {
  name: string;
  description: string;
  lastComputedAt: number;
  memberCount: number;
  members: Record<string, true>;
}

export interface Journey {
  name: string;
  trigger: 'user_created' | 'room_created' | 'manual';
  enabled: boolean;
  steps: Record<string, JourneyStep>;
}

export interface JourneyStep {
  channel: 'email' | 'push';
  delayMs: number;
  templateId: string;
  condition: string | null;
}

export interface JourneyState {
  startedAt: number;
  currentStep: number;
  lastStepAt: number;
  completed: boolean;
}

// ─── Event tracking ─────────────────────────────────────────────────

export type TrackableEvent =
  | 'push_received'
  | 'push_opened'
  | 'email_sent'
  | 'room_created'
  | 'room_joined'
  | 'login'
  | 'signup'
  | 'profile_updated'
  | 'ad_viewed'
  | 'session_start';

export interface TrackedEvent {
  type: TrackableEvent;
  timestamp: number;
  metadata?: Record<string, string>;
}

// ─── Flow-based journeys ────────────────────────────────────────────

export interface JourneyFlow {
  name: string;
  trigger: 'user_created' | 'room_created' | 'manual';
  enabled: boolean;
  flow: {
    nodes: FlowNode[];
    edges: FlowEdge[];
  };
  createdAt: number;
  updatedAt: number;
}

export interface FlowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'delay' | 'exit';
  position: { x: number; y: number };
  data: TriggerData | ActionData | ConditionData | DelayData | ExitData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

export interface TriggerData {
  label?: string;
  triggerType: 'user_created' | 'room_created' | 'manual';
}

export interface ActionData {
  label?: string;
  channel: 'email' | 'push';
  templateId: string;
  customSubject?: string;
  customBody?: string;
  customTitle?: string;
  pushImageUrl?: string | null;
  pushActionUrl?: string | null;
}

export interface ConditionData {
  label?: string;
  conditionType: 'event_occurred' | 'user_property' | 'time_elapsed';
  eventType?: TrackableEvent;
  sinceTrigger?: boolean;
  field?: string;
  operator?: ConditionOperator;
  value?: string | number | boolean | null;
  elapsedMs?: number;
}

export interface DelayData {
  label?: string;
  delayMs: number;
}

export interface ExitData {
  label?: string;
}

export interface FlowJourneyState {
  enteredAt: number;
  currentNodeId: string;
  lastProcessedAt: number;
  waitingSince: number | null;
  completed: boolean;
  path: string[];
}

// ─── Send log ───────────────────────────────────────────────────────

export interface SendLogEntry {
  userId: string;
  channel: 'email' | 'push';
  source: 'campaign' | 'journey';
  sourceId: string;
  sentAt: number;
  success: boolean;
  error: string | null;
}

export interface SegmentDefinition {
  id: string;
  name: string;
  description: string;
  compute: (ctx: SegmentContext) => Set<string>;
}

export interface SegmentContext {
  users: Record<string, any>;
  emailStates: Record<string, any>;
  statuses: Record<string, any>;
  now: number;
}

// ─── Custom segment rule schema ──────────────────────────────────────

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
  // User profile
  { path: 'profile.email', label: 'Email address', source: 'users', type: 'string' },
  { path: 'profile.authProvider', label: 'Auth provider', source: 'users', type: 'enum', enumValues: ['google', 'email', 'anonymous'] },
  { path: 'profile.createdAt', label: 'Account created', source: 'users', type: 'timestamp' },
  { path: 'profile.displayName', label: 'Display name', source: 'users', type: 'string' },
  { path: 'pushToken', label: 'Push token', source: 'users', type: 'string' },
  { path: 'platform', label: 'Platform', source: 'users', type: 'enum', enumValues: ['ios', 'android'] },
  // Preferences
  { path: 'preferences.emailOptIn', label: 'Email opt-in', source: 'users', type: 'boolean' },
  { path: 'preferences.pushOptIn', label: 'Push opt-in', source: 'users', type: 'boolean' },
  // Email state
  { path: 'unsubscribed', label: 'Unsubscribed', source: 'emailState', type: 'boolean' },
  { path: 'hasCreatedRoom', label: 'Has created room', source: 'emailState', type: 'boolean' },
  { path: 'welcomeSentAt', label: 'Welcome email sent', source: 'emailState', type: 'timestamp' },
  { path: 'tipsSentAt', label: 'Tips email sent', source: 'emailState', type: 'timestamp' },
  { path: 'reengagementSentAt', label: 'Re-engagement sent', source: 'emailState', type: 'timestamp' },
  // Status
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
