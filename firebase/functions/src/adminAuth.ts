import { getAuth } from 'firebase-admin/auth';
import { logger } from 'firebase-functions';

/**
 * Admin gate shared by every admin-only HTTP endpoint.
 *
 * Admins are listed by Firebase Auth UID in the ADMIN_UIDS environment
 * variable (comma-separated). The list is read on every request and the gate
 * FAILS CLOSED: if ADMIN_UIDS is empty or unset, nobody is allowed through.
 */

export class AdminAuthError extends Error {
  constructor(message: string, readonly status: 401 | 403) {
    super(message);
  }
}

export function adminUids(): string[] {
  return (process.env.ADMIN_UIDS || '')
    .split(',')
    .map((uid) => uid.trim())
    .filter(Boolean);
}

interface RequestLike {
  headers?: { authorization?: string | string[] };
  method?: string;
  path?: string;
}

/**
 * Verify the request carries a Firebase ID token that belongs to a listed admin.
 * Resolves to the caller's UID; throws AdminAuthError otherwise.
 */
export async function requireAdmin(req: RequestLike, endpoint: string): Promise<string> {
  const admins = adminUids();
  if (admins.length === 0) {
    logger.warn(`[AdminAuth] ADMIN_UIDS is empty or unset; denying all access to ${endpoint}`);
    throw new AdminAuthError('Admin access is not configured', 403);
  }

  const header = req.headers?.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    throw new AdminAuthError('No auth token', 401);
  }

  let uid: string;
  try {
    uid = (await getAuth().verifyIdToken(header.slice('Bearer '.length))).uid;
  } catch {
    throw new AdminAuthError('Invalid auth token', 401);
  }

  if (!admins.includes(uid)) {
    // Caller UID is logged (not the admin list) so attempts can be audited.
    logger.warn(`[AdminAuth] Denied non-admin caller on ${endpoint}`, { uid, method: req.method, path: req.path });
    throw new AdminAuthError('Not authorized', 403);
  }

  logger.info(`[AdminAuth] Admin request on ${endpoint}`, { uid, method: req.method, path: req.path });
  return uid;
}
