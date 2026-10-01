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
