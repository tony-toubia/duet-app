import { ref, push, serverTimestamp } from 'firebase/database';
import { firebaseAuth, firebaseDb } from './firebase';

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

/** File a safety report for Duet's moderators (users can't read reports back). */
export async function submitReport(input: {
  reportedUid: string;
  reason: ReportReason;
  context: ReportContext;
  details?: string;
  roomCode?: string | null;
}): Promise<void> {
  const me = firebaseAuth.currentUser;
  if (!me) throw new Error('Must be signed in.');
  const report: Record<string, any> = {
    reporterUid: me.uid,
    reportedUid: input.reportedUid,
    reason: input.reason,
    context: input.context,
    createdAt: serverTimestamp(),
  };
  const details = input.details?.trim().slice(0, 1000);
  if (details) report.details = details;
  if (input.roomCode) report.roomCode = input.roomCode.slice(0, 20);
  await push(ref(firebaseDb, '/reports'), report);
}
