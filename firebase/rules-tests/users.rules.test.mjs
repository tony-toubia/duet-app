import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { ref, get, set, update, query, orderByChild, equalTo, limitToFirst } from 'firebase/database';

const env = await initializeTestEnvironment({
  projectId: 'demo-duet',
  // Host/port come from FIREBASE_DATABASE_EMULATOR_HOST, set by emulators:exec
  database: { rules: readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8') },
});
await env.withSecurityRulesDisabled(async (ctx) => {
  await set(ref(ctx.database(), 'users'), {
    alice: { profile: { displayName: 'Alice', email: 'alice@example.com' }, preferences: { emailOptIn: true } },
    bob: {
      profile: { displayName: 'Bob', email: 'bob@example.com' },
      tokens: { dev1: { token: 'tok', platform: 'ios' } },
      preferences: { emailOptIn: false },
      persistentRoom: { partnerUid: 'carol', partnerName: 'Carol' },
    },
  });
  await set(ref(ctx.database(), 'status'), {
    alice: { state: 'online', lastSeen: 1 },
    bob: { state: 'online', lastSeen: 1 },
  });
  // alice and bob are friends; bob sent carol a request she hasn't accepted
  const entry = (status, initiatedBy, name) => ({ status, initiatedBy, displayName: name, addedAt: 1 });
  await set(ref(ctx.database(), 'friends'), {
    alice: { bob: entry('accepted', 'alice', 'Bob') },
    bob: { alice: entry('accepted', 'alice', 'Alice'), carol: entry('pending', 'bob', 'Carol') },
    carol: { bob: entry('pending', 'bob', 'Bob') },
  });
});

const alice = env.authenticatedContext('alice').database();
const bob = env.authenticatedContext('bob').database();
const carol = env.authenticatedContext('carol').database();
const mallory = env.authenticatedContext('mallory').database();
const guest = env.authenticatedContext('guest', { firebase: { sign_in_provider: 'anonymous' } }).database();
const anon = env.unauthenticatedContext().database();
const emailQuery = (db, extra = [limitToFirst(1)]) => query(ref(db, 'users'), orderByChild('profile/email'), equalTo('bob@example.com'), ...extra);

const cases = [
  ['signed-in user cannot bulk-read /users', () => assertFails(get(ref(alice, 'users')))],
  ['anonymous guest cannot bulk-read /users', () => assertFails(get(ref(guest, 'users')))],
  // Email search moved server-side: no client email query is allowed now
  ['client email query (limit 1) is denied', () => assertFails(get(emailQuery(alice)))],
  ['client email query is denied for a guest', () => assertFails(get(emailQuery(guest)))],
  ['email query without limit is denied', () => assertFails(get(emailQuery(alice, [])))],
  ['ordering by another field is denied', () => assertFails(get(query(ref(alice, 'users'), orderByChild('profile/displayName'), limitToFirst(1))))],
  ["can read another user's display name", () => assertSucceeds(get(ref(alice, 'users/bob/profile/displayName')))],
  ["can read another user's photo", () => assertSucceeds(get(ref(alice, 'users/bob/profile/avatarUrl')))],
  ["cannot read another user's email", () => assertFails(get(ref(alice, 'users/bob/profile/email')))],
  ["cannot read another user's whole profile", () => assertFails(get(ref(alice, 'users/bob/profile')))],
  ['can read own email', () => assertSucceeds(get(ref(bob, 'users/bob/profile/email')))],
  ["cannot read another user's push tokens", () => assertFails(get(ref(alice, 'users/bob/tokens')))],
  ["cannot read another user's preferences", () => assertFails(get(ref(alice, 'users/bob/preferences')))],
  ["cannot read another user's last partner", () => assertFails(get(ref(alice, 'users/bob/persistentRoom')))],
  ["cannot read another user's whole node", () => assertFails(get(ref(alice, 'users/bob')))],
  ['can read own whole node', () => assertSucceeds(get(ref(alice, 'users/alice')))],
  ['can read own preferences', () => assertSucceeds(get(ref(alice, 'users/alice/preferences')))],
  ['signed-out visitor cannot read profiles', () => assertFails(get(ref(anon, 'users/bob/profile')))],
  ['can still write own preferences', () => assertSucceeds(set(ref(alice, 'users/alice/preferences/emailOptIn'), false))],
  ["cannot write another user's data", () => assertFails(set(ref(alice, 'users/bob/preferences/emailOptIn'), true))],

  // Presence: own and accepted friends only
  ['can read own status', () => assertSucceeds(get(ref(alice, 'status/alice')))],
  ["accepted friend can read status", () => assertSucceeds(get(ref(alice, 'status/bob')))],
  ['pending (not yet accepted) contact cannot read status', () => assertFails(get(ref(carol, 'status/bob')))],
  ['stranger cannot read status', () => assertFails(get(ref(mallory, 'status/bob')))],

  // Friend entries: what the other person may write into your list
  ['stranger can send a pending request', () => assertSucceeds(set(ref(mallory, 'friends/alice/mallory'), { status: 'pending', initiatedBy: 'mallory', displayName: 'Mallory', addedAt: 1 }))],
  ['stranger cannot mark themselves accepted', () => assertFails(set(ref(mallory, 'friends/alice/mallory'), { status: 'accepted', initiatedBy: 'mallory', displayName: 'Mallory', addedAt: 1 }))],
  ['stranger cannot claim the owner initiated it', () => assertFails(set(ref(mallory, 'friends/alice/mallory'), { status: 'pending', initiatedBy: 'alice', displayName: 'Mallory', addedAt: 1 }))],
  ['cannot downgrade an accepted friendship to pending', () => assertFails(set(ref(bob, 'friends/alice/bob'), { status: 'pending', initiatedBy: 'bob', displayName: 'Bob', addedAt: 1 }))],
  ['recipient can accept a request (both entries)', () => assertSucceeds(update(ref(carol), { 'friends/carol/bob/status': 'accepted', 'friends/bob/carol/status': 'accepted' }))],
  ['requester cannot accept on the recipient\'s behalf', () => assertFails(update(ref(mallory), { 'friends/alice/mallory/status': 'accepted' }))],
  ['either side can remove the friendship', () => assertSucceeds(update(ref(bob), { 'friends/bob/alice': null, 'friends/alice/bob': null }))],
];

let failed = 0;
for (const [name, fn] of cases) {
  try { await fn(); console.log('PASS', name); }
  catch (e) { failed++; console.log('FAIL', name, '-', String(e.message || e).split('\n')[0]); }
}
await env.cleanup();
console.log(`${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
