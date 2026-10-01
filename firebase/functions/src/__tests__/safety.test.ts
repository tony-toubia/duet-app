import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }));
vi.mock('firebase-admin/database', () => ({ getDatabase: () => ({}) }));

import { reportAlertEmail, escapeHtml } from '../safety';

describe('reportAlertEmail', () => {
  const report = {
    reporterUid: 'bob',
    reportedUid: 'mallory',
    reason: 'harassment',
    context: 'room',
    roomCode: 'ROOM01',
    details: '<script>alert(1)</script> & more',
    createdAt: Date.UTC(2026, 9, 1),
  };

  it('escapes user-supplied text', () => {
    const { html } = reportAlertEmail('r1', report, { reporter: 'Bob', reported: '<img src=x onerror=1>' });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; more');
  });

  it('flags urgent reasons in the subject', () => {
    expect(reportAlertEmail('r1', { ...report, reason: 'underage' }, { reporter: 'a', reported: 'b' }).subject).toMatch(/^\[URGENT\]/);
    expect(reportAlertEmail('r1', report, { reporter: 'a', reported: 'b' }).subject).not.toMatch(/URGENT/);
  });

  it('escapeHtml handles quotes and null', () => {
    expect(escapeHtml(`"'`)).toBe('&quot;&#39;');
    expect(escapeHtml(null)).toBe('');
  });
});
