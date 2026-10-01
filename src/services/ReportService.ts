import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';

export type ReportReason = 'harassment' | 'hate' | 'sexual' | 'spam' | 'underage' | 'self_harm' | 'other';
export type ReportContext = 'room' | 'friend' | 'recent';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'sexual', label: 'Sexual content' },
  { value: 'spam', label: 'Spam or scams' },
  { value: 'underage', label: 'They may be under 13' },
  { value: 'self_harm', label: 'Self-harm or someone in danger' },
  { value: 'other', label: 'Something else' },
];

/**
 * File a safety report. Reports go to Duet's moderators (they can't be read
 * back by any user, including the reporter). Audio is never recorded, so
 * the report is based on what the reporter tells us.
 */
export async function submitReport(input: {
  reportedUid: string;
  reason: ReportReason;
  context: ReportContext;
  details?: string;
  roomCode?: string | null;
}): Promise<void> {
  const me = auth().currentUser;
  if (!me) throw new Error('Must be signed in.');
  const report: Record<string, any> = {
    reporterUid: me.uid,
    reportedUid: input.reportedUid,
    reason: input.reason,
    context: input.context,
    createdAt: database.ServerValue.TIMESTAMP,
  };
  const details = input.details?.trim().slice(0, 1000);
  if (details) report.details = details;
  if (input.roomCode) report.roomCode = input.roomCode.slice(0, 20);
  await database().ref('/reports').push(report);
}
