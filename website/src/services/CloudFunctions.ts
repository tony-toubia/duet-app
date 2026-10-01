import { firebaseAuth } from './firebase';

const FUNCTIONS_BASE_URL =
  process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL ||
  'https://us-central1-duet-33cf5.cloudfunctions.net';

export class CallableError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

/** Invoke a callable Cloud Function over the callable HTTPS protocol. */
export async function callFunction<T>(name: string, data: unknown = {}): Promise<T> {
  const user = firebaseAuth.currentUser;
  if (!user) throw new CallableError('Must be signed in.', 'UNAUTHENTICATED');
  const token = await user.getIdToken();

  const res = await fetch(`${FUNCTIONS_BASE_URL}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  });

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON body (e.g. a proxy error page); handled below
  }
  if (!res.ok || body?.error) {
    throw new CallableError(
      body?.error?.message || `Request failed (${res.status})`,
      body?.error?.status || String(res.status)
    );
  }
  return body?.result as T;
}
