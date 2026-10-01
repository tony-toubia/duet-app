import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { ref, get, set, query, orderByChild, equalTo, limitToFirst } from 'firebase/database';

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
});

const alice = env.authenticatedContext('alice').database();
const guest = env.authenticatedContext('guest', { firebase: { sign_in_provider: 'anonymous' } }).database();
const anon = env.unauthenticatedContext().database();
const emailQuery = (db, extra = [limitToFirst(1)]) => query(ref(db, 'users'), orderByChild('profile/email'), equalTo('bob@example.com'), ...extra);

const cases = [
  ['signed-in user cannot bulk-read /users', () => assertFails(get(ref(alice, 'users')))],
  ['anonymous guest cannot bulk-read /users', () => assertFails(get(ref(guest, 'users')))],
  ['friend search (email, limit 1) still works', () => assertSucceeds(get(emailQuery(alice)))],
  ['friend search works for a guest too', () => assertSucceeds(get(emailQuery(guest)))],
  ['email query without limit is denied', () => assertFails(get(emailQuery(alice, [])))],
  ['email query with a larger limit is denied', () => assertFails(get(emailQuery(alice, [limitToFirst(50)])))],
  ['ordering by another field is denied', () => assertFails(get(query(ref(alice, 'users'), orderByChild('profile/displayName'), limitToFirst(1))))],
  ["can read another user's profile", () => assertSucceeds(get(ref(alice, 'users/bob/profile')))],
  ["cannot read another user's push tokens", () => assertFails(get(ref(alice, 'users/bob/tokens')))],
  ["cannot read another user's preferences", () => assertFails(get(ref(alice, 'users/bob/preferences')))],
  ["cannot read another user's last partner", () => assertFails(get(ref(alice, 'users/bob/persistentRoom')))],
  ["cannot read another user's whole node", () => assertFails(get(ref(alice, 'users/bob')))],
  ['can read own whole node', () => assertSucceeds(get(ref(alice, 'users/alice')))],
  ['can read own preferences', () => assertSucceeds(get(ref(alice, 'users/alice/preferences')))],
  ['signed-out visitor cannot read profiles', () => assertFails(get(ref(anon, 'users/bob/profile')))],
  ['can still write own preferences', () => assertSucceeds(set(ref(alice, 'users/alice/preferences/emailOptIn'), false))],
  ["cannot write another user's data", () => assertFails(set(ref(alice, 'users/bob/preferences/emailOptIn'), true))],
];

let failed = 0;
for (const [name, fn] of cases) {
  try { await fn(); console.log('PASS', name); }
  catch (e) { failed++; console.log('FAIL', name, '-', String(e.message || e).split('\n')[0]); }
}
await env.cleanup();
console.log(`${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
