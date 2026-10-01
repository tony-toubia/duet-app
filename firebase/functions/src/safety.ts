/**
 * Safety reports: users report someone from a room or their friends list
 * (clients can only create reports; see database.rules.json). This module
 * formats the moderator alert and applies moderation decisions.
 */
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

export const REPORT_REASONS: Record<string, string> = {
  harassment: 'Harassment or bullying',
  hate: 'Hate speech',
  sexual: 'Sexual content',
  spam: 'Spam or scams',
  underage: 'May be under 13',
  self_harm: 'Self-harm or danger',
  other: 'Something else',
};

export const RESOLUTIONS = ['dismissed', 'warned', 'suspended'] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface ReportRecord {
  reporterUid: string;
  reportedUid: string;
  reason: string;
  context: string;
  details?: string;
  roomCode?: string;
  createdAt: number;
}

/** Moderator alert email. User-supplied text is escaped. */
export function reportAlertEmail(reportId: string, report: ReportRecord, names: { reporter: string; reported: string }) {
  const reason = REPORT_REASONS[report.reason] || report.reason;
  const urgent = report.reason === 'underage' || report.reason === 'self_harm';
  const subject = `${urgent ? '[URGENT] ' : ''}Duet safety report: ${reason}`;
  const rows: [string, string][] = [
    ['Reason', reason],
    ['Reported user', `${names.reported} (${report.reportedUid})`],
    ['Reported by', `${names.reporter} (${report.reporterUid})`],
    ['Where', report.context + (report.roomCode ? ` – room ${report.roomCode}` : '')],
    ['When', new Date(report.createdAt).toISOString()],
    ['Details', report.details || '(none)'],
    ['Report ID', reportId],
  ];
  const html =
    `<p>A Duet user filed a safety report. Review it in the admin panel under Reports.</p>` +
    `<table cellpadding="6" style="border-collapse:collapse">` +
    rows.map(([k, v]) => `<tr><th align="left" valign="top">${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join('') +
    `</table>`;
  return { subject, html };
}

/**
 * Record a moderator's decision. "suspended" disables the reported user's
 * sign-in and revokes their sessions; it can be undone with reinstateUser.
 */
export async function resolveReport(reportId: string, resolution: Resolution, note: string, adminUid: string) {
  const db = getDatabase();
  const ref = db.ref(`reports/${reportId}`);
  const report = (await ref.once('value')).val() as ReportRecord | null;
  if (!report) throw new Error('Report not found');

  if (resolution === 'suspended') {
    await getAuth().updateUser(report.reportedUid, { disabled: true });
    await getAuth().revokeRefreshTokens(report.reportedUid);
  }
  await ref.update({
    status: 'resolved',
    resolution,
    resolutionNote: note.slice(0, 1000),
    resolvedBy: adminUid,
    resolvedAt: Date.now(),
  });
  return { ...report, resolution };
}

export async function reinstateUser(uid: string) {
  await getAuth().updateUser(uid, { disabled: false });
}
