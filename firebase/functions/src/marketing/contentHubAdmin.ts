/**
 * Validation for manual Content Hub items created from the admin panel.
 * Items are written by the admin API (Admin SDK) because RTDB rules deny
 * all client writes to content_hub.
 */
export const CONTENT_TYPES = ['podcast', 'live_stream', 'playlist'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export interface ManualContentItem {
  title: string;
  type: ContentType;
  deepLink: string;
  image: string;
  city: string | null;
  source: 'manual';
  pinned: true;
  createdAt: number;
}

// Links open in the app and render as links on the web, so only allow
// schemes that can't run script (blocks javascript:, data:, vbscript:, ...)
const ALLOWED_LINK = /^(https?:\/\/|spotify:|duet:\/\/|youtube:\/\/|vnd\.youtube:|music:\/\/|podcasts:\/\/)/i;
const HTTPS_URL = /^https:\/\//i;

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function validateContentItem(body: any, now = Date.now()): ManualContentItem {
  const title = str(body?.title, 200);
  const type = body?.type;
  const deepLink = str(body?.deepLink, 2000);
  const image = str(body?.image, 2000);
  const city = str(body?.city, 100) || null;

  if (!title) throw new Error('Title is required.');
  if (!CONTENT_TYPES.includes(type)) throw new Error('Invalid content type.');
  if (!deepLink || !ALLOWED_LINK.test(deepLink)) throw new Error('Link must be an https:// URL or a supported app link.');
  if (image && !HTTPS_URL.test(image)) throw new Error('Image must be an https:// URL.');

  return { title, type, deepLink, image, city, source: 'manual', pinned: true, createdAt: now };
}

/** Push IDs only: letters, digits, '-' and '_'. */
export function isValidItemId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(id);
}
