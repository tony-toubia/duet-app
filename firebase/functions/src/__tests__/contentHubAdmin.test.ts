import { describe, it, expect } from 'vitest';
import { validateContentItem, isValidItemId } from '../marketing/contentHubAdmin';

describe('validateContentItem', () => {
  const base = { title: 'Morning Show', type: 'podcast', deepLink: 'https://open.spotify.com/show/x', image: 'https://i.example/a.png' };

  it('accepts a valid manual item and fixes source/pinned', () => {
    const item = validateContentItem({ ...base, source: 'sync', pinned: false }, 5);
    expect(item).toMatchObject({ title: 'Morning Show', source: 'manual', pinned: true, createdAt: 5, city: null });
  });

  it('accepts app deep links', () => {
    expect(() => validateContentItem({ ...base, deepLink: 'spotify:show:abc' })).not.toThrow();
  });

  it('rejects script and data links', () => {
    for (const deepLink of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,x', 'vbscript:x', '']) {
      expect(() => validateContentItem({ ...base, deepLink })).toThrow();
    }
  });

  it('rejects non-https images, unknown types and empty titles', () => {
    expect(() => validateContentItem({ ...base, image: 'http://x/a.png' })).toThrow();
    expect(() => validateContentItem({ ...base, type: 'video' })).toThrow();
    expect(() => validateContentItem({ ...base, title: '   ' })).toThrow();
  });

  it('validates item ids', () => {
    expect(isValidItemId('-Nabc_123')).toBe(true);
    expect(isValidItemId('../config')).toBe(false);
    expect(isValidItemId('')).toBe(false);
  });
});
