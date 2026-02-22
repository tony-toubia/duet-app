import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getAnalytics, type Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Lazy initialization to avoid running during Next.js static generation
// (env vars are undefined at build time, causing auth/invalid-api-key)
let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Database | null = null;
let _storage: FirebaseStorage | null = null;
let _analytics: Analytics | null = null;

function getApp(): FirebaseApp {
  if (!_app) {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return _app;
}

export const firebaseAuth: Auth = new Proxy({} as Auth, {
  get(_, prop) {
    if (!_auth) _auth = getAuth(getApp());
    return (_auth as any)[prop];
  },
});

export const firebaseDb: Database = new Proxy({} as Database, {
  get(_, prop) {
    if (!_db) _db = getDatabase(getApp());
    return (_db as any)[prop];
  },
});

export const firebaseStorage: FirebaseStorage = new Proxy({} as FirebaseStorage, {
  get(_, prop) {
    if (!_storage) {
      const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      _storage = bucket
        ? getStorage(getApp(), `gs://${bucket}`)
        : getStorage(getApp());
    }
    return (_storage as any)[prop];
  },
});

export function getFirebaseAnalytics(): Analytics | null {
  if (typeof window === 'undefined') return null;
  if (!_analytics) {
    try { _analytics = getAnalytics(getApp()); } catch { return null; }
  }
  return _analytics;
}
