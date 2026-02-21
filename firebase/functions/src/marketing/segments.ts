import { getDatabase } from 'firebase-admin/database';
import type { SegmentDefinition, SegmentContext, SegmentRuleSet, SegmentCondition, FieldDefinition } from './types';
import { SEGMENT_FIELDS } from './types';

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

// ─── Segment definitions ─────────────────────────────────────────────

export const SEGMENT_DEFINITIONS: SegmentDefinition[] = [
  {
    id: 'all_authenticated',
    name: 'All authenticated users',
    description: 'Every user with a non-anonymous account',
    compute: ({ users }) => {
      const members = new Set<string>();
      for (const [uid, u] of Object.entries(users)) {
        if (u.profile?.authProvider && u.profile.authProvider !== 'anonymous') {
          members.add(uid);
        }
      }
      return members;
    },
  },
  {
    id: 'has_email',
    name: 'Has email address',
    description: 'Authenticated users with an email on file',
    compute: ({ users }) => {
      const members = new Set<string>();
      for (const [uid, u] of Object.entries(users)) {
        if (u.profile?.email && u.profile.authProvider !== 'anonymous') {
          members.add(uid);
        }
      }
      return members;
    },
  },
  {
    id: 'has_email_subscribed',
    name: 'Subscribed email users',
    description: 'Has email and not unsubscribed',
    compute: ({ users, emailStates }) => {
      const members = new Set<string>();
      for (const [uid, u] of Object.entries(users)) {
        if (u.profile?.email && u.profile.authProvider !== 'anonymous') {
          const es = emailStates[uid];
          if (!es?.unsubscribed) members.add(uid);
        }
      }
      return members;
    },
  },
  {
    id: 'has_push_token',
    name: 'Has push token',
    description: 'Users with a registered push notification token',
    compute: ({ users }) => {
      const members = new Set<string>();
      for (const [uid, u] of Object.entries(users)) {
        if (u.pushToken) members.add(uid);
      }
      return members;
    },
  },
  {
    id: 'signed_up_no_room',
    name: 'Signed up, no room created',
    description: 'Authenticated email users who never created a room',
    compute: ({ users, emailStates }) => {
      const members = new Set<string>();
      for (const [uid, u] of Object.entries(users)) {
        if (u.profile?.email && u.profile.authProvider !== 'anonymous') {
          const es = emailStates[uid];
          if (!es?.hasCreatedRoom) members.add(uid);
        }
      }
      return members;
    },
  },
  {
    id: 'active_7d',
    name: 'Active last 7 days',
    description: 'Users seen online in the past week',
    compute: ({ users, statuses, now }) => {
      const members = new Set<string>();
      const cutoff = now - SEVEN_DAYS;
      for (const [uid, u] of Object.entries(users)) {
        if (u.profile?.authProvider === 'anonymous') continue;
        const status = statuses[uid];
        if (status?.lastSeen && status.lastSeen > cutoff) members.add(uid);
      }
      return members;
    },
  },
  {
    id: 'inactive_7d',
    name: 'Inactive 7+ days',
    description: 'Users not seen online for over a week',
    compute: ({ users, statuses, now }) => {
      const members = new Set<string>();
      const cutoff = now - SEVEN_DAYS;
      for (const [uid, u] of Object.entries(users)) {
        if (u.profile?.authProvider === 'anonymous') continue;
        if (!u.profile?.email) continue;
        const status = statuses[uid];
        if (!status?.lastSeen || status.lastSeen <= cutoff) members.add(uid);
      }
      return members;
    },
  },
  {
    id: 'new_users_24h',
    name: 'New in last 24 hours',
    description: 'Users who signed up in the past day',
    compute: ({ users, now }) => {
      const members = new Set<string>();
      const cutoff = now - TWENTY_FOUR_HOURS;
      for (const [uid, u] of Object.entries(users)) {
        if (u.profile?.authProvider === 'anonymous') continue;
        if (u.profile?.createdAt && u.profile.createdAt > cutoff) members.add(uid);
      }
      return members;
    },
  },
  {
    id: 'ios_users',
    name: 'iOS users',
    description: 'Users on an iOS device',
    compute: ({ users }) => {
      const members = new Set<string>();
      for (const [uid, u] of Object.entries(users)) {
        if (u.platform === 'ios') members.add(uid);
      }
      return members;
    },
  },
  {
    id: 'android_users',
    name: 'Android users',
    description: 'Users on an Android device',
    compute: ({ users }) => {
      const members = new Set<string>();
      for (const [uid, u] of Object.entries(users)) {
        if (u.platform === 'android') members.add(uid);
      }
      return members;
    },
  },
  {
    id: 'email_and_push',
    name: 'Email + push available',
    description: 'Subscribed email users who also have a push token',
    compute: ({ users, emailStates }) => {
      const members = new Set<string>();
      for (const [uid, u] of Object.entries(users)) {
        if (!u.profile?.email || u.profile.authProvider === 'anonymous') continue;
        if (!u.pushToken) continue;
        const es = emailStates[uid];
        if (!es?.unsubscribed) members.add(uid);
      }
      return members;
    },
  },
];

// ─── Custom segment rule evaluator ───────────────────────────────────

const FIELD_MAP = new Map(SEGMENT_FIELDS.map((f) => [f.path, f]));

function resolvePath(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function getFieldValue(uid: string, fieldDef: FieldDefinition, ctx: SegmentContext): any {
  let source: any;
  switch (fieldDef.source) {
    case 'users':      source = ctx.users[uid]; break;
    case 'emailState': source = ctx.emailStates[uid]; break;
    case 'status':     source = ctx.statuses[uid]; break;
  }
  if (!source) return undefined;
  return resolvePath(source, fieldDef.path);
}

function evaluateCondition(value: any, cond: SegmentCondition, now: number): boolean {
  switch (cond.operator) {
    case 'exists':             return value != null && value !== '';
    case 'not_exists':         return value == null || value === '';
    case 'is_true':            return value === true;
    case 'is_false':           return value === false || value == null;
    case 'equals':             return value == cond.value;
    case 'not_equals':         return value != cond.value;
    case 'contains':           return typeof value === 'string' && value.toLowerCase().includes(String(cond.value).toLowerCase());
    case 'not_contains':       return typeof value === 'string' && !value.toLowerCase().includes(String(cond.value).toLowerCase());
    case 'greater_than':       return typeof value === 'number' && value > Number(cond.value);
    case 'less_than':          return typeof value === 'number' && value < Number(cond.value);
    case 'between':            return typeof value === 'number' && value >= Number(cond.value) && value <= Number(cond.value2);
    case 'within_last_days': {
      if (typeof value !== 'number') return false;
      return value >= now - Number(cond.value) * 86400000;
    }
    case 'more_than_days_ago': {
      if (typeof value !== 'number') return false;
      return value < now - Number(cond.value) * 86400000;
    }
    default: return false;
  }
}

function evaluateRuleSet(uid: string, rules: SegmentRuleSet, ctx: SegmentContext): boolean {
  const groupResults = rules.groups.map((group) => {
    const condResults = group.conditions.map((cond) => {
      const fieldDef = FIELD_MAP.get(cond.field);
      if (!fieldDef) return false;
      const value = getFieldValue(uid, fieldDef, ctx);
      return evaluateCondition(value, cond, ctx.now);
    });
    return group.combinator === 'AND'
      ? condResults.every(Boolean)
      : condResults.some(Boolean);
  });
  return rules.combinator === 'AND'
    ? groupResults.every(Boolean)
    : groupResults.some(Boolean);
}

export function computeCustomSegment(rules: SegmentRuleSet, ctx: SegmentContext): Set<string> {
  const members = new Set<string>();
  for (const uid of Object.keys(ctx.users)) {
    if (evaluateRuleSet(uid, rules, ctx)) members.add(uid);
  }
  return members;
}

// ─── Segment computation ─────────────────────────────────────────────

export async function computeAllSegments(): Promise<Record<string, number>> {
  const db = getDatabase();
  const now = Date.now();

  const [usersSnap, emailStatesSnap, statusesSnap] = await Promise.all([
    db.ref('users').once('value'),
    db.ref('emailState').once('value'),
    db.ref('status').once('value'),
  ]);

  const ctx: SegmentContext = {
    users: usersSnap.val() || {},
    emailStates: emailStatesSnap.val() || {},
    statuses: statusesSnap.val() || {},
    now,
  };

  const counts: Record<string, number> = {};
  const updates: Record<string, any> = {};

  for (const def of SEGMENT_DEFINITIONS) {
    const memberSet = def.compute(ctx);
    const members: Record<string, true> = {};
    for (const uid of memberSet) {
      members[uid] = true;
    }

    counts[def.id] = memberSet.size;
    updates[`segments/${def.id}`] = {
      name: def.name,
      description: def.description,
      lastComputedAt: now,
      memberCount: memberSet.size,
      members,
    };
  }

  // Process custom segments
  const customSnap = await db.ref('marketing/customSegments').once('value');
  const customSegments = customSnap.val() || {};

  for (const [id, def] of Object.entries(customSegments) as [string, any][]) {
    if (!def.rules?.groups?.length) continue;
    const memberSet = computeCustomSegment(def.rules, ctx);
    const members: Record<string, true> = {};
    for (const uid of memberSet) members[uid] = true;

    counts[id] = memberSet.size;
    updates[`segments/${id}`] = {
      name: def.name,
      description: def.description || '',
      lastComputedAt: now,
      memberCount: memberSet.size,
      members,
      isCustom: true,
    };
  }

  await db.ref('marketing').update(updates);
  console.log('[Segments] Computed all segments:', JSON.stringify(counts));
  return counts;
}
