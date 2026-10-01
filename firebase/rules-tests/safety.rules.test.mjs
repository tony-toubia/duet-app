// Rules tests for blocking and reporting (run via `npm test`).
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { ref, get, set, update, push, serverTimestamp } from 'firebase/database';

const env = await initializeTestEnvironment({
  projectId: 'demo-duet-safety',
  database: { rules: readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8') },
});
await env.withSecurityRulesDisabled(async (ctx) => {
  await set(ref(ctx.database()), {
    blocks: { alice: { mallory: { blockedAt: 1, displayName: 'Mallory' } } },
    rooms: { ROOM01: { createdAt: Date.now(), createdBy: 'alice', members: { alice: { role: 'host', joinedAt: 1 } } } },
    reports: { r0: { reporterUid: 'bob', reportedUid: 'mallory', reason: 'spam', context: 'room', createdAt: 1 } },
  });
});

const alice = env.authenticatedContext('alice').database();
const bob = env.authenticatedContext('bob').database();
const mallory = env.authenticatedContext('mallory').database();

const request = (from, name) => ({ status: 'pending', initiatedBy: from, displayName: name, addedAt: 1 });
const invite = (from, to) => ({ fromUid: from, toUid: to, fromDisplayName: 'X', roomCode: 'ROOM01', createdAt: 1 });
const report = (extra = {}) => ({ reporterUid: 'bob', reportedUid: 'mallory', reason: 'harassment', context: 'room', createdAt: serverTimestamp(), ...extra });

const cases = [
  // Block list
  ['can read own block list', () => assertSucceeds(get(ref(alice, 'blocks/alice')))],
  ["cannot read someone else's block list", () => assertFails(get(ref(mallory, 'blocks/alice')))],
  ['can block someone', () => assertSucceeds(set(ref(bob, 'blocks/bob/mallory'), { blockedAt: 1, displayName: 'Mallory' }))],
  ['cannot block yourself', () => assertFails(set(ref(bob, 'blocks/bob/bob'), { blockedAt: 1 }))],
  ["cannot edit someone else's block list", () => assertFails(set(ref(mallory, 'blocks/alice/mallory'), null))],
  ['can unblock', () => assertSucceeds(set(ref(bob, 'blocks/bob/mallory'), null))],

  // What a block prevents
  ['blocked user cannot send a friend request', () => assertFails(set(ref(mallory, 'friends/alice/mallory'), request('mallory', 'Mallory')))],
  ['others can still send one', () => assertSucceeds(set(ref(bob, 'friends/alice/bob'), request('bob', 'Bob')))],
  ['blocked user cannot invite', () => assertFails(set(ref(mallory, 'invitations/i1'), invite('mallory', 'alice')))],
  ['others can still invite', () => assertSucceeds(set(ref(bob, 'invitations/i2'), invite('bob', 'alice')))],
  ["blocked user cannot join the blocker's room", () => assertFails(set(ref(mallory, 'rooms/ROOM01/members/mallory'), { role: 'answerer', joinedAt: 1 }))],
  ["others can join it", () => assertSucceeds(set(ref(bob, 'rooms/ROOM01/members/bob'), { role: 'answerer', joinedAt: 1 }))],

  // Reports
  ['can file a report', () => assertSucceeds(set(push(ref(bob, 'reports')), report({ details: 'Kept shouting', roomCode: 'ROOM01' })))],
  ['cannot file a report as someone else', () => assertFails(set(push(ref(mallory, 'reports')), report()))],
  ['cannot report yourself', () => assertFails(set(push(ref(bob, 'reports')), report({ reportedUid: 'bob' })))],
  ['reason must be from the list', () => assertFails(set(push(ref(bob, 'reports')), report({ reason: 'meh' })))],
  ['timestamp must be the server time', () => assertFails(set(push(ref(bob, 'reports')), report({ createdAt: 1 })))],
  ['details are length-limited', () => assertFails(set(push(ref(bob, 'reports')), report({ details: 'x'.repeat(1001) })))],
  ['extra fields are rejected', () => assertFails(set(push(ref(bob, 'reports')), report({ status: 'resolved' })))],
  ['cannot read reports', () => assertFails(get(ref(bob, 'reports/r0')))],
  ['cannot edit or delete a report', () => assertFails(update(ref(bob, 'reports/r0'), { reason: 'other' }))],
];

let failed = 0;
for (const [name, fn] of cases) {
  try { await fn(); console.log('PASS', name); }
  catch (e) { failed++; console.log('FAIL', name, '-', String(e.message || e).split('\n')[0]); }
}
await env.cleanup();
console.log(`${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
