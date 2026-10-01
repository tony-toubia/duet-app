import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const verifyIdToken = vi.fn();
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken }) }));
vi.mock('firebase-functions', () => ({ logger: { warn: vi.fn(), info: vi.fn() } }));

import { requireAdmin, AdminAuthError, adminUids } from '../adminAuth';

const withToken = (token = 'valid-token') => ({ headers: { authorization: `Bearer ${token}` }, method: 'GET', path: '/x' });

describe('requireAdmin', () => {
  const original = process.env.ADMIN_UIDS;

  beforeEach(() => {
    verifyIdToken.mockReset();
    verifyIdToken.mockResolvedValue({ uid: 'admin-1' });
  });

  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_UIDS;
    else process.env.ADMIN_UIDS = original;
  });

  it('denies everyone when ADMIN_UIDS is unset (fails closed)', async () => {
    delete process.env.ADMIN_UIDS;
    await expect(requireAdmin(withToken(), 'test')).rejects.toMatchObject({ status: 403 });
    // Never even consults the token: no configured admin can be matched
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('denies everyone when ADMIN_UIDS is empty or only separators', async () => {
    for (const value of ['', ' ', ',', ' , ,']) {
      process.env.ADMIN_UIDS = value;
      await expect(requireAdmin(withToken(), 'test')).rejects.toBeInstanceOf(AdminAuthError);
    }
  });

  it('rejects a request with no bearer token', async () => {
    process.env.ADMIN_UIDS = 'admin-1';
    await expect(requireAdmin({ headers: {} }, 'test')).rejects.toMatchObject({ status: 401 });
  });

  it('rejects an invalid or expired token', async () => {
    process.env.ADMIN_UIDS = 'admin-1';
    verifyIdToken.mockRejectedValue(new Error('expired'));
    await expect(requireAdmin(withToken('bad'), 'test')).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a valid signed-in user who is not on the list', async () => {
    process.env.ADMIN_UIDS = 'admin-1,admin-2';
    verifyIdToken.mockResolvedValue({ uid: 'regular-user' });
    await expect(requireAdmin(withToken(), 'test')).rejects.toMatchObject({ status: 403 });
  });

  it('admits a listed admin and returns their uid', async () => {
    process.env.ADMIN_UIDS = ' admin-2 , admin-1 ';
    await expect(requireAdmin(withToken(), 'test')).resolves.toBe('admin-1');
  });

  it('parses the list with whitespace and empty entries removed', () => {
    process.env.ADMIN_UIDS = ' a ,, b ,';
    expect(adminUids()).toEqual(['a', 'b']);
  });
});
