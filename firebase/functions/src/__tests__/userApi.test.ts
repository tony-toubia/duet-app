import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUserByEmail = vi.fn();
const profiles: Record<string, any> = {};
const checkRateLimit = vi.fn();

vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ getUserByEmail }) }));
vi.mock('firebase-admin/database', () => ({
  getDatabase: () => ({
    ref: (path: string) => ({
      once: async () => {
        const uid = path.split('/')[2];
        return { val: () => profiles[uid] ?? null };
      },
    }),
  }),
}));
vi.mock('../rateLimit', () => ({ checkRateLimit: (...args: unknown[]) => checkRateLimit(...args) }));

import { findUserByEmail } from '../userApi';

describe('findUserByEmail', () => {
  beforeEach(() => {
    getUserByEmail.mockReset();
    checkRateLimit.mockReset();
    checkRateLimit.mockResolvedValue(true);
    for (const k of Object.keys(profiles)) delete profiles[k];
  });

  it('returns only public fields, never the email or other profile data', async () => {
    getUserByEmail.mockResolvedValue({ uid: 'bob' });
    profiles.bob = { displayName: 'Bob', avatarUrl: 'https://x/a.png', email: 'bob@example.com', friendCode: 'ABCDEFGH' };
    const result = await findUserByEmail('alice', '  Bob@Example.com ');
    expect(result).toEqual({ uid: 'bob', displayName: 'Bob', avatarUrl: 'https://x/a.png' });
    expect(getUserByEmail).toHaveBeenCalledWith('bob@example.com');
  });

  it('returns null for an unknown email', async () => {
    getUserByEmail.mockRejectedValue({ code: 'auth/user-not-found' });
    expect(await findUserByEmail('alice', 'nobody@example.com')).toBeNull();
  });

  it('returns null when searching for yourself', async () => {
    getUserByEmail.mockResolvedValue({ uid: 'alice' });
    profiles.alice = { displayName: 'Alice' };
    expect(await findUserByEmail('alice', 'alice@example.com')).toBeNull();
  });

  it('rejects malformed input without hitting Auth', async () => {
    for (const bad of ['', 'not-an-email', 42, null, 'a@b']) {
      await expect(findUserByEmail('alice', bad)).rejects.toMatchObject({ code: 'invalid-argument' });
    }
    expect(getUserByEmail).not.toHaveBeenCalled();
  });

  it('is rate limited per caller', async () => {
    checkRateLimit.mockResolvedValue(false);
    await expect(findUserByEmail('alice', 'bob@example.com')).rejects.toMatchObject({ code: 'resource-exhausted' });
    expect(checkRateLimit).toHaveBeenCalledWith('alice', 'email_search', 20, 3600000);
    expect(getUserByEmail).not.toHaveBeenCalled();
  });

  it('surfaces unexpected Auth errors', async () => {
    getUserByEmail.mockRejectedValue(new Error('boom'));
    await expect(findUserByEmail('alice', 'bob@example.com')).rejects.toThrow('boom');
  });
});

import { createHmac } from 'crypto';
import { issueTurnCredentials, TURN_CREDENTIAL_TTL_SECONDS } from '../userApi';

describe('issueTurnCredentials', () => {
  const now = Date.UTC(2026, 9, 1, 12, 0, 0);

  it('mints coturn REST-API credentials that expire and name the account', () => {
    const result = issueTurnCredentials('alice', { host: 'relay.example', mode: 'secret', sharedSecret: 's3cret' }, now);
    const [server] = result.iceServers;
    const expiry = Math.floor(now / 1000) + TURN_CREDENTIAL_TTL_SECONDS;
    expect(server.username).toBe(`${expiry}:alice`);
    expect(server.credential).toBe(createHmac('sha1', 's3cret').update(`${expiry}:alice`).digest('base64'));
    expect(server.urls).toEqual(['turn:relay.example:3478?transport=udp', 'turn:relay.example:3478?transport=tcp']);
    expect(result.expiresAt).toBe(expiry * 1000);
  });

  it('gives different users different credentials', () => {
    const cfg = { host: 'h', mode: 'secret' as const, sharedSecret: 'k' };
    expect(issueTurnCredentials('a', cfg, now).iceServers[0].credential)
      .not.toBe(issueTurnCredentials('b', cfg, now).iceServers[0].credential);
  });

  it('adds a TLS url when a TLS host is configured', () => {
    const r = issueTurnCredentials('a', { host: 'h', tlsHost: 'turn.example.com', mode: 'secret', sharedSecret: 'k' }, now);
    expect(r.iceServers[0].urls).toContain('turns:turn.example.com:5349?transport=tcp');
  });

  it('serves the static credential in transition mode', () => {
    const r = issueTurnCredentials('a', { host: 'h', mode: 'static', staticUsername: 'duet', staticPassword: 'pw' }, now);
    expect(r.iceServers[0]).toMatchObject({ username: 'duet', credential: 'pw' });
  });

  it('refuses when the relay is not configured', () => {
    expect(() => issueTurnCredentials('a', { host: '', mode: 'secret', sharedSecret: 'k' }, now)).toThrow();
    expect(() => issueTurnCredentials('a', { host: 'h', mode: 'secret' }, now)).toThrow();
    expect(() => issueTurnCredentials('a', { host: 'h', mode: 'static' }, now)).toThrow();
  });
});
