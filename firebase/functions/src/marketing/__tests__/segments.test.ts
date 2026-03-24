import { describe, it, expect } from 'vitest';
import {
  resolvePath,
  getFieldValue,
  evaluateCondition,
  evaluateCampaignCondition,
  evaluateRuleSet,
  computeCustomSegment,
  SEGMENT_DEFINITIONS,
} from '../segments';
import type {
  SegmentContext,
  SegmentCondition,
  SegmentRuleSet,
  SendLogEntry,
} from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const NOW = 1700000000000; // Fixed timestamp for deterministic tests

function makeCtx(overrides: Partial<SegmentContext> = {}): SegmentContext {
  return {
    users: {},
    emailStates: {},
    statuses: {},
    sendLogByUser: {},
    now: NOW,
    ...overrides,
  };
}

function cond(
  field: string,
  operator: SegmentCondition['operator'],
  value: SegmentCondition['value'] = null,
  value2?: number | null,
): SegmentCondition {
  return { field, operator, value, ...(value2 != null ? { value2 } : {}) };
}

function ruleSet(
  combinator: 'AND' | 'OR',
  ...groups: { combinator: 'AND' | 'OR'; conditions: SegmentCondition[] }[]
): SegmentRuleSet {
  return { combinator, groups };
}

function group(
  combinator: 'AND' | 'OR',
  ...conditions: SegmentCondition[]
) {
  return { combinator, conditions };
}

// ─── resolvePath ────────────────────────────────────────────────────────────

describe('resolvePath', () => {
  it('resolves a top-level key', () => {
    expect(resolvePath({ name: 'Alice' }, 'name')).toBe('Alice');
  });

  it('resolves a nested key', () => {
    expect(resolvePath({ profile: { email: 'a@b.com' } }, 'profile.email')).toBe('a@b.com');
  });

  it('returns undefined for missing intermediate', () => {
    expect(resolvePath({ profile: null }, 'profile.email')).toBeUndefined();
  });

  it('returns undefined for missing leaf', () => {
    expect(resolvePath({ profile: {} }, 'profile.email')).toBeUndefined();
  });

  it('returns undefined for null root', () => {
    expect(resolvePath(null, 'anything')).toBeUndefined();
  });

  it('resolves deeply nested paths', () => {
    const obj = { a: { b: { c: { d: 42 } } } };
    expect(resolvePath(obj, 'a.b.c.d')).toBe(42);
  });
});

// ─── getFieldValue ──────────────────────────────────────────────────────────

describe('getFieldValue', () => {
  it('reads from users source', () => {
    const ctx = makeCtx({ users: { u1: { profile: { email: 'test@test.com' } } } });
    const fieldDef = { path: 'profile.email', label: 'Email', source: 'users' as const, type: 'string' as const };
    expect(getFieldValue('u1', fieldDef, ctx)).toBe('test@test.com');
  });

  it('reads from emailState source', () => {
    const ctx = makeCtx({ emailStates: { u1: { unsubscribed: true } } });
    const fieldDef = { path: 'unsubscribed', label: 'Unsubscribed', source: 'emailState' as const, type: 'boolean' as const };
    expect(getFieldValue('u1', fieldDef, ctx)).toBe(true);
  });

  it('reads from status source', () => {
    const ctx = makeCtx({ statuses: { u1: { state: 'online', lastSeen: 123 } } });
    const fieldDef = { path: 'state', label: 'State', source: 'status' as const, type: 'enum' as const };
    expect(getFieldValue('u1', fieldDef, ctx)).toBe('online');
  });

  it('returns undefined for missing user', () => {
    const ctx = makeCtx();
    const fieldDef = { path: 'profile.email', label: 'Email', source: 'users' as const, type: 'string' as const };
    expect(getFieldValue('u999', fieldDef, ctx)).toBeUndefined();
  });
});

// ─── evaluateCondition — all operators ──────────────────────────────────────

describe('evaluateCondition', () => {
  describe('exists / not_exists', () => {
    it('exists: true for non-null non-empty value', () => {
      expect(evaluateCondition('hello', cond('f', 'exists'), NOW)).toBe(true);
    });

    it('exists: false for null', () => {
      expect(evaluateCondition(null, cond('f', 'exists'), NOW)).toBe(false);
    });

    it('exists: false for undefined', () => {
      expect(evaluateCondition(undefined, cond('f', 'exists'), NOW)).toBe(false);
    });

    it('exists: false for empty string', () => {
      expect(evaluateCondition('', cond('f', 'exists'), NOW)).toBe(false);
    });

    it('exists: true for 0 (falsy but present)', () => {
      expect(evaluateCondition(0, cond('f', 'exists'), NOW)).toBe(true);
    });

    it('exists: true for false (falsy but present)', () => {
      expect(evaluateCondition(false, cond('f', 'exists'), NOW)).toBe(true);
    });

    it('not_exists: true for null', () => {
      expect(evaluateCondition(null, cond('f', 'not_exists'), NOW)).toBe(true);
    });

    it('not_exists: true for empty string', () => {
      expect(evaluateCondition('', cond('f', 'not_exists'), NOW)).toBe(true);
    });

    it('not_exists: false for value present', () => {
      expect(evaluateCondition('hi', cond('f', 'not_exists'), NOW)).toBe(false);
    });
  });

  describe('is_true / is_false', () => {
    it('is_true: true for true', () => {
      expect(evaluateCondition(true, cond('f', 'is_true'), NOW)).toBe(true);
    });

    it('is_true: false for false', () => {
      expect(evaluateCondition(false, cond('f', 'is_true'), NOW)).toBe(false);
    });

    it('is_true: false for truthy non-boolean', () => {
      expect(evaluateCondition(1, cond('f', 'is_true'), NOW)).toBe(false);
    });

    it('is_false: true for false', () => {
      expect(evaluateCondition(false, cond('f', 'is_false'), NOW)).toBe(true);
    });

    it('is_false: true for null (treats missing as false)', () => {
      expect(evaluateCondition(null, cond('f', 'is_false'), NOW)).toBe(true);
    });

    it('is_false: true for undefined', () => {
      expect(evaluateCondition(undefined, cond('f', 'is_false'), NOW)).toBe(true);
    });

    it('is_false: false for true', () => {
      expect(evaluateCondition(true, cond('f', 'is_false'), NOW)).toBe(false);
    });
  });

  describe('equals / not_equals (loose comparison)', () => {
    it('equals: string match', () => {
      expect(evaluateCondition('ios', cond('f', 'equals', 'ios'), NOW)).toBe(true);
    });

    it('equals: number match', () => {
      expect(evaluateCondition(42, cond('f', 'equals', 42), NOW)).toBe(true);
    });

    it('equals: numeric coercion (number vs string)', () => {
      // Strict === with numeric coercion: 42 === Number('42')
      expect(evaluateCondition(42, cond('f', 'equals', '42'), NOW)).toBe(true);
    });

    it('equals: mismatch', () => {
      expect(evaluateCondition('ios', cond('f', 'equals', 'android'), NOW)).toBe(false);
    });

    it('not_equals: true for mismatch', () => {
      expect(evaluateCondition('ios', cond('f', 'not_equals', 'android'), NOW)).toBe(true);
    });

    it('not_equals: false for match', () => {
      expect(evaluateCondition('ios', cond('f', 'not_equals', 'ios'), NOW)).toBe(false);
    });

    it('equals: null === null is true', () => {
      expect(evaluateCondition(null, cond('f', 'equals', null), NOW)).toBe(true);
    });

    it('equals: null !== undefined (strict)', () => {
      expect(evaluateCondition(undefined, cond('f', 'equals', null), NOW)).toBe(false);
    });

    it('equals: false !== "0" (no loose coercion)', () => {
      expect(evaluateCondition(false, cond('f', 'equals', '0'), NOW)).toBe(false);
    });

    it('not_equals: null !== undefined is true (strict)', () => {
      expect(evaluateCondition(undefined, cond('f', 'not_equals', null), NOW)).toBe(true);
    });
  });

  describe('contains / not_contains', () => {
    it('contains: case-insensitive substring match', () => {
      expect(evaluateCondition('Hello World', cond('f', 'contains', 'hello'), NOW)).toBe(true);
    });

    it('contains: no match', () => {
      expect(evaluateCondition('Hello World', cond('f', 'contains', 'xyz'), NOW)).toBe(false);
    });

    it('contains: false for non-string value', () => {
      expect(evaluateCondition(42, cond('f', 'contains', '42'), NOW)).toBe(false);
    });

    it('not_contains: true when substring absent', () => {
      expect(evaluateCondition('Hello', cond('f', 'not_contains', 'xyz'), NOW)).toBe(true);
    });

    it('not_contains: false when substring present', () => {
      expect(evaluateCondition('Hello', cond('f', 'not_contains', 'hell'), NOW)).toBe(false);
    });

    it('not_contains: true for non-string value (number cannot contain a string)', () => {
      expect(evaluateCondition(42, cond('f', 'not_contains', '42'), NOW)).toBe(true);
    });
  });

  describe('greater_than / less_than', () => {
    it('greater_than: true when value > threshold', () => {
      expect(evaluateCondition(10, cond('f', 'greater_than', 5), NOW)).toBe(true);
    });

    it('greater_than: false when equal', () => {
      expect(evaluateCondition(5, cond('f', 'greater_than', 5), NOW)).toBe(false);
    });

    it('greater_than: false when less', () => {
      expect(evaluateCondition(3, cond('f', 'greater_than', 5), NOW)).toBe(false);
    });

    it('greater_than: false for non-number', () => {
      expect(evaluateCondition('10', cond('f', 'greater_than', 5), NOW)).toBe(false);
    });

    it('less_than: true when value < threshold', () => {
      expect(evaluateCondition(3, cond('f', 'less_than', 5), NOW)).toBe(true);
    });

    it('less_than: false when equal', () => {
      expect(evaluateCondition(5, cond('f', 'less_than', 5), NOW)).toBe(false);
    });

    it('less_than: false when greater', () => {
      expect(evaluateCondition(10, cond('f', 'less_than', 5), NOW)).toBe(false);
    });
  });

  describe('between', () => {
    it('inclusive on lower bound', () => {
      expect(evaluateCondition(5, cond('f', 'between', 5, 10), NOW)).toBe(true);
    });

    it('inclusive on upper bound', () => {
      expect(evaluateCondition(10, cond('f', 'between', 5, 10), NOW)).toBe(true);
    });

    it('true for value in range', () => {
      expect(evaluateCondition(7, cond('f', 'between', 5, 10), NOW)).toBe(true);
    });

    it('false for value below range', () => {
      expect(evaluateCondition(4, cond('f', 'between', 5, 10), NOW)).toBe(false);
    });

    it('false for value above range', () => {
      expect(evaluateCondition(11, cond('f', 'between', 5, 10), NOW)).toBe(false);
    });

    it('false for non-number', () => {
      expect(evaluateCondition('7', cond('f', 'between', 5, 10), NOW)).toBe(false);
    });

    it('false when value2 is undefined (missing upper bound)', () => {
      expect(evaluateCondition(7, { field: 'f', operator: 'between', value: 5 }, NOW)).toBe(false);
    });

    it('false when value2 is null', () => {
      expect(evaluateCondition(7, cond('f', 'between', 5, null), NOW)).toBe(false);
    });
  });

  describe('within_last_days / more_than_days_ago', () => {
    const ONE_DAY = 86400000;

    it('within_last_days: true for recent timestamp', () => {
      const recentTs = NOW - ONE_DAY * 3; // 3 days ago
      expect(evaluateCondition(recentTs, cond('f', 'within_last_days', 7), NOW)).toBe(true);
    });

    it('within_last_days: false for old timestamp', () => {
      const oldTs = NOW - ONE_DAY * 10; // 10 days ago
      expect(evaluateCondition(oldTs, cond('f', 'within_last_days', 7), NOW)).toBe(false);
    });

    it('within_last_days: true for exact boundary', () => {
      const boundaryTs = NOW - ONE_DAY * 7; // exactly 7 days ago
      expect(evaluateCondition(boundaryTs, cond('f', 'within_last_days', 7), NOW)).toBe(true);
    });

    it('within_last_days: false for non-number', () => {
      expect(evaluateCondition('yesterday', cond('f', 'within_last_days', 7), NOW)).toBe(false);
    });

    it('more_than_days_ago: true for old timestamp', () => {
      const oldTs = NOW - ONE_DAY * 10;
      expect(evaluateCondition(oldTs, cond('f', 'more_than_days_ago', 7), NOW)).toBe(true);
    });

    it('more_than_days_ago: false for recent timestamp', () => {
      const recentTs = NOW - ONE_DAY * 3;
      expect(evaluateCondition(recentTs, cond('f', 'more_than_days_ago', 7), NOW)).toBe(false);
    });

    it('more_than_days_ago: false for exact boundary', () => {
      const boundaryTs = NOW - ONE_DAY * 7;
      expect(evaluateCondition(boundaryTs, cond('f', 'more_than_days_ago', 7), NOW)).toBe(false);
    });
  });

  describe('unknown operator', () => {
    it('returns false for unrecognized operator', () => {
      expect(evaluateCondition('x', { field: 'f', operator: 'bogus' as any, value: 'x' }, NOW)).toBe(false);
    });
  });
});

// ─── evaluateCampaignCondition ──────────────────────────────────────────────

describe('evaluateCampaignCondition', () => {
  const sendLog: SendLogEntry[] = [
    { userId: 'u1', channel: 'email', source: 'campaign', sourceId: 'camp1', sentAt: 100, success: true, error: null },
    { userId: 'u1', channel: 'push', source: 'journey', sourceId: 'j1', sentAt: 200, success: true, error: null },
  ];

  it('was_sent: true when campaign was sent to user', () => {
    const ctx = makeCtx({ sendLogByUser: { u1: sendLog } });
    expect(evaluateCampaignCondition('u1', cond('campaign', 'was_sent', 'camp1'), ctx)).toBe(true);
  });

  it('was_sent: false when campaign was not sent to user', () => {
    const ctx = makeCtx({ sendLogByUser: { u1: sendLog } });
    expect(evaluateCampaignCondition('u1', cond('campaign', 'was_sent', 'camp2'), ctx)).toBe(false);
  });

  it('was_sent: false for journey source (not campaign)', () => {
    const ctx = makeCtx({ sendLogByUser: { u1: sendLog } });
    expect(evaluateCampaignCondition('u1', cond('campaign', 'was_sent', 'j1'), ctx)).toBe(false);
  });

  it('was_not_sent: true when campaign not sent', () => {
    const ctx = makeCtx({ sendLogByUser: { u1: sendLog } });
    expect(evaluateCampaignCondition('u1', cond('campaign', 'was_not_sent', 'camp2'), ctx)).toBe(true);
  });

  it('was_not_sent: false when campaign was sent', () => {
    const ctx = makeCtx({ sendLogByUser: { u1: sendLog } });
    expect(evaluateCampaignCondition('u1', cond('campaign', 'was_not_sent', 'camp1'), ctx)).toBe(false);
  });

  it('returns false for empty campaign value', () => {
    const ctx = makeCtx({ sendLogByUser: { u1: sendLog } });
    expect(evaluateCampaignCondition('u1', cond('campaign', 'was_sent', ''), ctx)).toBe(false);
  });

  it('returns false for null campaign value', () => {
    const ctx = makeCtx({ sendLogByUser: { u1: sendLog } });
    expect(evaluateCampaignCondition('u1', cond('campaign', 'was_sent', null), ctx)).toBe(false);
  });

  it('handles user with no send log', () => {
    const ctx = makeCtx();
    expect(evaluateCampaignCondition('u1', cond('campaign', 'was_sent', 'camp1'), ctx)).toBe(false);
    expect(evaluateCampaignCondition('u1', cond('campaign', 'was_not_sent', 'camp1'), ctx)).toBe(true);
  });
});

// ─── evaluateRuleSet — compound logic ───────────────────────────────────────

describe('evaluateRuleSet', () => {
  const ctx = makeCtx({
    users: {
      u1: {
        profile: { email: 'alice@test.com', authProvider: 'google', displayName: 'Alice', createdAt: NOW - 86400000 },
        platform: 'ios',
        pushToken: 'tok1',
        preferences: { emailOptIn: true, pushOptIn: true },
      },
    },
    emailStates: { u1: { unsubscribed: false, hasCreatedRoom: true } },
    statuses: { u1: { state: 'online', lastSeen: NOW - 3600000 } },
  });

  describe('single group, single condition', () => {
    it('matches when condition is true', () => {
      const rules = ruleSet('AND', group('AND', cond('platform', 'equals', 'ios')));
      expect(evaluateRuleSet('u1', rules, ctx)).toBe(true);
    });

    it('does not match when condition is false', () => {
      const rules = ruleSet('AND', group('AND', cond('platform', 'equals', 'android')));
      expect(evaluateRuleSet('u1', rules, ctx)).toBe(false);
    });
  });

  describe('AND group combinator', () => {
    it('all conditions must be true', () => {
      const rules = ruleSet('AND', group('AND',
        cond('platform', 'equals', 'ios'),
        cond('profile.authProvider', 'equals', 'google'),
      ));
      expect(evaluateRuleSet('u1', rules, ctx)).toBe(true);
    });

    it('fails if any condition is false', () => {
      const rules = ruleSet('AND', group('AND',
        cond('platform', 'equals', 'ios'),
        cond('profile.authProvider', 'equals', 'email'),
      ));
      expect(evaluateRuleSet('u1', rules, ctx)).toBe(false);
    });
  });

  describe('OR group combinator', () => {
    it('passes if any condition is true', () => {
      const rules = ruleSet('AND', group('OR',
        cond('platform', 'equals', 'android'),
        cond('profile.authProvider', 'equals', 'google'),
      ));
      expect(evaluateRuleSet('u1', rules, ctx)).toBe(true);
    });

    it('fails if all conditions are false', () => {
      const rules = ruleSet('AND', group('OR',
        cond('platform', 'equals', 'android'),
        cond('profile.authProvider', 'equals', 'anonymous'),
      ));
      expect(evaluateRuleSet('u1', rules, ctx)).toBe(false);
    });
  });

  describe('multiple groups with AND combinator', () => {
    it('all groups must match', () => {
      const rules = ruleSet('AND',
        group('AND', cond('platform', 'equals', 'ios')),
        group('AND', cond('profile.authProvider', 'equals', 'google')),
      );
      expect(evaluateRuleSet('u1', rules, ctx)).toBe(true);
    });

    it('fails if any group fails', () => {
      const rules = ruleSet('AND',
        group('AND', cond('platform', 'equals', 'ios')),
        group('AND', cond('profile.authProvider', 'equals', 'anonymous')),
      );
      expect(evaluateRuleSet('u1', rules, ctx)).toBe(false);
    });
  });

  describe('multiple groups with OR combinator', () => {
    it('passes if any group matches', () => {
      const rules = ruleSet('OR',
        group('AND', cond('platform', 'equals', 'android')),
        group('AND', cond('profile.authProvider', 'equals', 'google')),
      );
      expect(evaluateRuleSet('u1', rules, ctx)).toBe(true);
    });

    it('fails if no group matches', () => {
      const rules = ruleSet('OR',
        group('AND', cond('platform', 'equals', 'android')),
        group('AND', cond('profile.authProvider', 'equals', 'anonymous')),
      );
      expect(evaluateRuleSet('u1', rules, ctx)).toBe(false);
    });
  });

  describe('nested compound rules', () => {
    it('AND of ORs', () => {
      // (ios OR android) AND (google OR email) — should match u1
      const rules = ruleSet('AND',
        group('OR', cond('platform', 'equals', 'ios'), cond('platform', 'equals', 'android')),
        group('OR', cond('profile.authProvider', 'equals', 'google'), cond('profile.authProvider', 'equals', 'email')),
      );
      expect(evaluateRuleSet('u1', rules, ctx)).toBe(true);
    });

    it('OR of ANDs', () => {
      // (android AND google) OR (ios AND google) — second group matches
      const rules = ruleSet('OR',
        group('AND', cond('platform', 'equals', 'android'), cond('profile.authProvider', 'equals', 'google')),
        group('AND', cond('platform', 'equals', 'ios'), cond('profile.authProvider', 'equals', 'google')),
      );
      expect(evaluateRuleSet('u1', rules, ctx)).toBe(true);
    });
  });

  describe('cross-source conditions', () => {
    it('combines user + emailState + status conditions', () => {
      const rules = ruleSet('AND',
        group('AND',
          cond('platform', 'equals', 'ios'),
          cond('hasCreatedRoom', 'is_true'),
          cond('state', 'equals', 'online'),
        ),
      );
      expect(evaluateRuleSet('u1', rules, ctx)).toBe(true);
    });
  });

  describe('timestamp conditions in rules', () => {
    it('within_last_days on lastSeen', () => {
      const rules = ruleSet('AND', group('AND', cond('lastSeen', 'within_last_days', 1)));
      expect(evaluateRuleSet('u1', rules, ctx)).toBe(true);
    });

    it('more_than_days_ago on lastSeen (fails for recent)', () => {
      const rules = ruleSet('AND', group('AND', cond('lastSeen', 'more_than_days_ago', 1)));
      expect(evaluateRuleSet('u1', rules, ctx)).toBe(false);
    });
  });

  describe('campaign conditions in rules', () => {
    it('was_sent matches user with campaign history', () => {
      const ctxWithLog = makeCtx({
        users: { u1: { profile: { authProvider: 'email' } } },
        sendLogByUser: {
          u1: [{ userId: 'u1', channel: 'email', source: 'campaign', sourceId: 'c1', sentAt: 100, success: true, error: null }],
        },
      });
      const rules = ruleSet('AND', group('AND', cond('campaign', 'was_sent', 'c1')));
      expect(evaluateRuleSet('u1', rules, ctxWithLog)).toBe(true);
    });

    it('was_not_sent excludes user with campaign history', () => {
      const ctxWithLog = makeCtx({
        users: { u1: { profile: { authProvider: 'email' } } },
        sendLogByUser: {
          u1: [{ userId: 'u1', channel: 'email', source: 'campaign', sourceId: 'c1', sentAt: 100, success: true, error: null }],
        },
      });
      const rules = ruleSet('AND', group('AND', cond('campaign', 'was_not_sent', 'c1')));
      expect(evaluateRuleSet('u1', rules, ctxWithLog)).toBe(false);
    });
  });

  describe('unknown field', () => {
    it('returns false for condition with unknown field', () => {
      const rules = ruleSet('AND', group('AND', cond('nonexistent.field', 'equals', 'x')));
      expect(evaluateRuleSet('u1', rules, ctx)).toBe(false);
    });
  });
});

// ─── computeCustomSegment ───────────────────────────────────────────────────

describe('computeCustomSegment', () => {
  it('returns matching users from a population', () => {
    const ctx = makeCtx({
      users: {
        u1: { platform: 'ios', profile: { authProvider: 'google' } },
        u2: { platform: 'android', profile: { authProvider: 'email' } },
        u3: { platform: 'ios', profile: { authProvider: 'email' } },
      },
    });
    const rules = ruleSet('AND', group('AND', cond('platform', 'equals', 'ios')));
    const result = computeCustomSegment(rules, ctx);
    expect(result).toEqual(new Set(['u1', 'u3']));
  });

  it('returns empty set when no users match', () => {
    const ctx = makeCtx({
      users: {
        u1: { platform: 'android' },
        u2: { platform: 'android' },
      },
    });
    const rules = ruleSet('AND', group('AND', cond('platform', 'equals', 'ios')));
    expect(computeCustomSegment(rules, ctx).size).toBe(0);
  });

  it('returns all users when rule matches everyone', () => {
    const ctx = makeCtx({
      users: {
        u1: { platform: 'ios' },
        u2: { platform: 'ios' },
      },
    });
    const rules = ruleSet('AND', group('AND', cond('platform', 'equals', 'ios')));
    expect(computeCustomSegment(rules, ctx).size).toBe(2);
  });

  it('handles complex multi-group rules across population', () => {
    const ctx = makeCtx({
      users: {
        u1: { platform: 'ios', profile: { authProvider: 'google', email: 'a@b.com' }, preferences: { emailOptIn: true } },
        u2: { platform: 'android', profile: { authProvider: 'email', email: 'b@b.com' }, preferences: { emailOptIn: true } },
        u3: { platform: 'ios', profile: { authProvider: 'anonymous' }, preferences: {} },
      },
      emailStates: {
        u1: { unsubscribed: false },
        u2: { unsubscribed: true },
        u3: { unsubscribed: false },
      },
    });
    // ios users who are NOT unsubscribed
    const rules = ruleSet('AND',
      group('AND', cond('platform', 'equals', 'ios')),
      group('AND', cond('unsubscribed', 'is_false')),
    );
    const result = computeCustomSegment(rules, ctx);
    // u1: ios + not unsubscribed ✓
    // u2: android ✗
    // u3: ios + not unsubscribed ✓ (undefined treated as false)
    expect(result).toEqual(new Set(['u1', 'u3']));
  });
});

// ─── Built-in segment definitions ───────────────────────────────────────────

describe('SEGMENT_DEFINITIONS', () => {
  const baseUsers = {
    u1: { profile: { email: 'a@test.com', authProvider: 'google', createdAt: NOW - 3600000 }, platform: 'ios', pushToken: 'tok1', preferences: { emailOptIn: true, pushOptIn: true } },
    u2: { profile: { email: 'b@test.com', authProvider: 'email', createdAt: NOW - 86400000 * 10 }, platform: 'android', pushToken: null, preferences: { emailOptIn: false, pushOptIn: false } },
    u3: { profile: { authProvider: 'anonymous', createdAt: NOW - 86400000 * 2 }, platform: 'ios', pushToken: 'tok3', preferences: {} },
    u4: { profile: { email: 'c@test.com', authProvider: 'email', createdAt: NOW - 3600000 }, platform: 'android', pushToken: 'tok4', preferences: { emailOptIn: true, pushOptIn: true } },
  };

  const baseEmailStates = {
    u1: { unsubscribed: false, hasCreatedRoom: true, welcomeSentAt: NOW - 1000 },
    u2: { unsubscribed: true, hasCreatedRoom: false },
    u4: { unsubscribed: false, hasCreatedRoom: false },
  };

  const baseStatuses = {
    u1: { state: 'online', lastSeen: NOW - 3600000 }, // 1 hour ago
    u2: { state: 'offline', lastSeen: NOW - 86400000 * 10 }, // 10 days ago
    u3: { state: 'offline', lastSeen: NOW - 86400000 * 2 }, // 2 days ago
    u4: { state: 'online', lastSeen: NOW - 1800000 }, // 30 min ago
  };

  function findDef(id: string) {
    return SEGMENT_DEFINITIONS.find((d) => d.id === id)!;
  }

  const ctx = makeCtx({ users: baseUsers, emailStates: baseEmailStates, statuses: baseStatuses });

  it('all_authenticated: excludes anonymous', () => {
    const result = findDef('all_authenticated').compute(ctx);
    expect(result).toEqual(new Set(['u1', 'u2', 'u4']));
  });

  it('has_email: authenticated users with email', () => {
    const result = findDef('has_email').compute(ctx);
    expect(result).toEqual(new Set(['u1', 'u2', 'u4']));
  });

  it('has_email_subscribed: email users not unsubscribed and opt-in', () => {
    const result = findDef('has_email_subscribed').compute(ctx);
    // u1: email, not unsubscribed, emailOptIn true ✓
    // u2: email, but unsubscribed ✗
    // u4: email, not unsubscribed, emailOptIn true ✓
    expect(result).toEqual(new Set(['u1', 'u4']));
  });

  it('has_push_token: users with push token', () => {
    const result = findDef('has_push_token').compute(ctx);
    expect(result).toEqual(new Set(['u1', 'u3', 'u4']));
  });

  it('push_opted_in: push token + opted in', () => {
    const result = findDef('push_opted_in').compute(ctx);
    // u1: token + opted in ✓
    // u3: token + no pref (default not false) ✓
    // u4: token + opted in ✓
    expect(result).toEqual(new Set(['u1', 'u3', 'u4']));
  });

  it('signed_up_no_room: email users without room', () => {
    const result = findDef('signed_up_no_room').compute(ctx);
    // u1: has room ✗
    // u2: no room ✓
    // u4: no room ✓
    expect(result).toEqual(new Set(['u2', 'u4']));
  });

  it('active_7d: seen in last 7 days (non-anonymous)', () => {
    const result = findDef('active_7d').compute(ctx);
    // u1: 1 hour ago ✓
    // u2: 10 days ago ✗
    // u3: anonymous ✗ (excluded)
    // u4: 30 min ago ✓
    expect(result).toEqual(new Set(['u1', 'u4']));
  });

  it('inactive_7d: not seen in 7+ days (non-anonymous, has email)', () => {
    const result = findDef('inactive_7d').compute(ctx);
    // u1: 1 hour ago ✗
    // u2: 10 days ago ✓
    // u3: anonymous, no email ✗
    // u4: 30 min ago ✗
    expect(result).toEqual(new Set(['u2']));
  });

  it('new_users_24h: created in last 24 hours', () => {
    const result = findDef('new_users_24h').compute(ctx);
    // u1: 1 hour ago ✓
    // u2: 10 days ago ✗
    // u3: anonymous ✗
    // u4: 1 hour ago ✓
    expect(result).toEqual(new Set(['u1', 'u4']));
  });

  it('ios_users: platform ios', () => {
    const result = findDef('ios_users').compute(ctx);
    expect(result).toEqual(new Set(['u1', 'u3']));
  });

  it('android_users: platform android', () => {
    const result = findDef('android_users').compute(ctx);
    expect(result).toEqual(new Set(['u2', 'u4']));
  });

  it('email_and_push: email subscribed + push token + both opted in', () => {
    const result = findDef('email_and_push').compute(ctx);
    // u1: email, not unsub, push token, both opted in ✓
    // u2: email but unsubscribed ✗
    // u3: anonymous ✗
    // u4: email, not unsub, push token, both opted in ✓
    expect(result).toEqual(new Set(['u1', 'u4']));
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('empty groups array returns true (vacuous truth for AND)', () => {
    const ctx = makeCtx({ users: { u1: {} } });
    const rules: SegmentRuleSet = { combinator: 'AND', groups: [] };
    // every([]) returns true
    expect(evaluateRuleSet('u1', rules, ctx)).toBe(true);
  });

  it('empty conditions array in group returns true for AND', () => {
    const ctx = makeCtx({ users: { u1: {} } });
    const rules = ruleSet('AND', { combinator: 'AND', conditions: [] });
    expect(evaluateRuleSet('u1', rules, ctx)).toBe(true);
  });

  it('empty conditions array in group returns false for OR', () => {
    const ctx = makeCtx({ users: { u1: {} } });
    const rules = ruleSet('AND', { combinator: 'OR', conditions: [] });
    // some([]) returns false
    expect(evaluateRuleSet('u1', rules, ctx)).toBe(false);
  });

  it('computeCustomSegment with no users returns empty set', () => {
    const ctx = makeCtx();
    const rules = ruleSet('AND', group('AND', cond('platform', 'equals', 'ios')));
    expect(computeCustomSegment(rules, ctx).size).toBe(0);
  });

  it('string contains with empty search string matches everything', () => {
    expect(evaluateCondition('hello', cond('f', 'contains', ''), NOW)).toBe(true);
  });

  it('between with equal bounds (single value)', () => {
    expect(evaluateCondition(5, cond('f', 'between', 5, 5), NOW)).toBe(true);
    expect(evaluateCondition(6, cond('f', 'between', 5, 5), NOW)).toBe(false);
  });
});
