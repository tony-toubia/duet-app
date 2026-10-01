// Integration test for account deletion (firebase/functions/src/accountDeletion.ts)
// against the Realtime Database and Auth emulators. Run via `npm test`, which
// builds the functions first and starts both emulators.
import { createRequire } from 'module';

// Never run against a real project
if (!process.env.FIREBASE_DATABASE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  console.error('Database, Auth and Storage emulators are required (run via npm test).');
  process.exit(1);
}

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, cert } = require('firebase-admin/app');
const { generateKeyPairSync } = require('crypto');
const { getDatabase } = require('firebase-admin/database');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');

initializeApp({
  // Emulators ignore credentials, but the Admin SDK insists on a service
  // account shape for Storage; use a throwaway key (no metadata lookup)
  credential: cert({
    projectId: 'demo-duet',
    clientEmail: 'test@demo-duet.iam.gserviceaccount.com',
    privateKey: generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }),
  }),
  projectId: 'demo-duet',
  databaseURL: `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}?ns=demo-duet-default-rtdb`,
  storageBucket: 'demo-duet.appspot.com',
});
const { deleteUserAccount } = require('../functions/lib/accountDeletion.js');

const db = getDatabase();
const auth = getAuth();

const entry = (status, initiatedBy, name) => ({ status, initiatedBy, displayName: name, addedAt: 1 });
const recent = (name) => ({ displayName: name, lastConnectedAt: 1, roomCode: 'ABC123' });

await auth.createUser({ uid: 'alice', email: 'alice@example.com' });
const bucket = getStorage().bucket();
await bucket.file('avatars/alice.jpg').save(Buffer.from('jpeg'));
await bucket.file('avatars/bob.jpg').save(Buffer.from('jpeg'));
await auth.createUser({ uid: 'bob', email: 'bob@example.com' });
await db.ref().set({
  users: {
    alice: { profile: { displayName: 'Alice', email: 'alice@example.com', friendCode: 'ALICE234' } },
    bob: { profile: { displayName: 'Bob' }, persistentRoom: { partnerUid: 'alice', partnerName: 'Alice' } },
    carol: { profile: { displayName: 'Carol' }, persistentRoom: { partnerUid: 'bob', partnerName: 'Bob' } },
  },
  friends: {
    alice: { bob: entry('accepted', 'alice', 'Bob') },
    bob: { alice: entry('accepted', 'alice', 'Alice'), carol: entry('accepted', 'bob', 'Carol') },
    carol: { bob: entry('accepted', 'bob', 'Bob') },
  },
  recentConnections: {
    alice: { carol: recent('Carol') },
    carol: { alice: recent('Alice'), bob: recent('Bob') },
  },
  friendCodes: { ALICE234: 'alice', BOBB2345: 'bob' },
  status: { alice: { state: 'online', lastSeen: 1 }, bob: { state: 'online', lastSeen: 1 } },
  events: { alice: { room_created: { e1: { type: 'room_created', timestamp: 1 } } } },
  invitations: {
    i1: { fromUid: 'alice', toUid: 'bob', fromDisplayName: 'Alice', roomCode: 'R1', createdAt: 1 },
    i2: { fromUid: 'carol', toUid: 'alice', fromDisplayName: 'Carol', roomCode: 'R2', createdAt: 1 },
    i3: { fromUid: 'carol', toUid: 'bob', fromDisplayName: 'Carol', roomCode: 'R3', createdAt: 1 },
  },
  emailState: { alice: { unsubscribed: false } },
  marketing: {
    journeyState: { alice: { j1: { startedAt: 1 } } },
    sendLog: { s1: { userId: 'alice', sentAt: 1 }, s2: { userId: 'bob', sentAt: 1 } },
  },
});

const summary = await deleteUserAccount('alice');

const exists = async (p) => (await db.ref(p).once('value')).exists();
const checks = [
  ['own user node removed', !(await exists('users/alice'))],
  ['own friends list removed', !(await exists('friends/alice'))],
  ["entry in friend's list removed", !(await exists('friends/bob/alice'))],
  ['own recent connections removed', !(await exists('recentConnections/alice'))],
  ["entry in partner's recents removed", !(await exists('recentConnections/carol/alice'))],
  ["partner's quick-reconnect to this user removed", !(await exists('users/bob/persistentRoom'))],
  ['friend code released', !(await exists('friendCodes/ALICE234'))],
  ['status removed', !(await exists('status/alice'))],
  ['events removed', !(await exists('events/alice'))],
  ['invitation sent removed', !(await exists('invitations/i1'))],
  ['invitation received removed', !(await exists('invitations/i2'))],
  ['email state removed', !(await exists('emailState/alice'))],
  ['journey state removed', !(await exists('marketing/journeyState/alice'))],
  ['send log entries removed', !(await exists('marketing/sendLog/s1'))],
  ['avatar removed', !(await bucket.file('avatars/alice.jpg').exists())[0]],
  ["other users' avatars kept", (await bucket.file('avatars/bob.jpg').exists())[0]],
  ['Auth account removed', await auth.getUser('alice').then(() => false, (e) => e.code === 'auth/user-not-found')],
  // Untouched
  ["other users' unrelated data kept", (await exists('friends/bob/carol')) && (await exists('recentConnections/carol/bob'))],
  ["other users' own shortcuts kept", await exists('users/carol/persistentRoom')],
  ['other friend codes kept', await exists('friendCodes/BOBB2345')],
  ["other users' invitations kept", await exists('invitations/i3')],
  ["other users' send log kept", await exists('marketing/sendLog/s2')],
  ['other Auth accounts kept', await auth.getUser('bob').then(() => true, () => false)],
  ['summary reports the auth delete', summary.authUserRemoved === true],
];

const second = await deleteUserAccount('alice').then(() => true, (e) => (console.log(e), false));
checks.push(['running it twice is safe', second]);

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) failed++;
  console.log(ok ? 'PASS' : 'FAIL', name);
}
console.log(`${checks.length - failed}/${checks.length} passed`);
process.exit(failed ? 1 : 0);
