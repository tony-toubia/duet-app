import { getDatabase } from 'firebase-admin/database';
import type { SegmentDefinition, SegmentContext } from './types';

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

  await db.ref('marketing').update(updates);
  console.log('[Segments] Computed all segments:', JSON.stringify(counts));
  return counts;
}
