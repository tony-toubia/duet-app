'use client';

import { useEffect, useState } from 'react';
import { blockService } from '@/services/BlockService';
import { submitReport, REPORT_REASONS, ReportReason, ReportContext } from '@/services/ReportService';

export interface SafetyPerson {
  uid: string;
  displayName: string;
}

type Step = 'choose' | 'menu' | 'confirmBlock' | 'report' | 'done';

/**
 * Report and block, reachable from rooms and the friends list. Blocking is
 * silent (the other person isn't told); reports go to Duet's moderators.
 */
export function SafetySheet({
  people,
  context,
  roomCode,
  onClose,
  onBlocked,
}: {
  people: SafetyPerson[];
  context: ReportContext;
  roomCode?: string | null;
  onClose: () => void;
  onBlocked?: (uid: string) => void;
}) {
  const [step, setStep] = useState<Step>(people.length === 1 ? 'menu' : 'choose');
  const [person, setPerson] = useState<SafetyPerson | null>(people.length === 1 ? people[0] : null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const name = person?.displayName || 'this person';

  const doBlock = async () => {
    if (!person) return;
    setBusy(true);
    setError(null);
    try {
      await blockService.block(person.uid, person.displayName);
      setDoneMessage(`You blocked ${name}. They can't send you friend requests or invitations, or join rooms you create. They won't be notified.`);
      setStep('done');
      onBlocked?.(person.uid);
    } catch {
      setError('Could not block. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const doReport = async () => {
    if (!person || !reason) return;
    setBusy(true);
    setError(null);
    try {
      await submitReport({ reportedUid: person.uid, reason, context, details, roomCode });
      if (alsoBlock) {
        await blockService.block(person.uid, person.displayName);
        onBlocked?.(person.uid);
      }
      setDoneMessage(
        'Thanks for telling us. Our team reviews every report.' +
          (alsoBlock ? ` You've also blocked ${name}.` : '') +
          (reason === 'self_harm' ? ' If someone is in immediate danger, contact local emergency services.' : '')
      );
      setStep('done');
    } catch {
      setError('Could not send the report. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const primary = 'w-full rounded-2xl py-3.5 font-bold text-base text-white transition-colors disabled:opacity-40';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Report or block"
        className="relative bg-white rounded-3xl p-6 w-full max-w-[380px] max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col gap-2.5 text-[#1a1a2e]"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'choose' && (
          <>
            <h2 className="text-xl font-bold text-center mb-1">Who do you want to report or block?</h2>
            {people.map((p) => (
              <button
                key={p.uid}
                className="text-left border border-[#e0e0e8] rounded-xl py-3 px-3.5"
                onClick={() => { setPerson(p); setStep('menu'); }}
              >
                {p.displayName}
              </button>
            ))}
          </>
        )}

        {step === 'menu' && (
          <>
            <h2 className="text-xl font-bold text-center mb-1">{name}</h2>
            <button className={`${primary} bg-primary hover:bg-primary-light`} onClick={() => setStep('report')}>Report</button>
            <button className={`${primary} bg-danger hover:bg-red-600`} onClick={() => setStep('confirmBlock')}>Block</button>
          </>
        )}

        {step === 'confirmBlock' && (
          <>
            <h2 className="text-xl font-bold text-center mb-1">Block {name}?</h2>
            <p className="text-sm text-[#6b6b80] text-center mb-1.5">
              They won&apos;t be able to send you friend requests or invitations, or join rooms you create. They won&apos;t be
              notified. You can unblock them from your Friends page.
            </p>
            <button className={`${primary} bg-danger hover:bg-red-600`} onClick={doBlock} disabled={busy}>
              {busy ? 'Blocking…' : 'Block'}
            </button>
          </>
        )}

        {step === 'report' && (
          <>
            <h2 className="text-xl font-bold text-center mb-1">Report {name}</h2>
            <p className="text-sm text-[#6b6b80] text-center mb-1.5">
              What&apos;s going on? Duet doesn&apos;t record audio, so tell us what happened.
            </p>
            <div role="radiogroup" className="flex flex-col gap-2">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.value}
                  role="radio"
                  aria-checked={reason === r.value}
                  onClick={() => setReason(r.value)}
                  className={`text-left border rounded-xl py-3 px-3.5 ${
                    reason === r.value ? 'border-primary bg-primary/10 font-semibold' : 'border-[#e0e0e8]'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <textarea
              className="border border-[#e0e0e8] rounded-xl p-3 min-h-[72px] text-[15px] outline-none focus:border-primary"
              placeholder="Add details (optional)"
              value={details}
              maxLength={1000}
              onChange={(e) => setDetails(e.target.value)}
            />
            <label className="flex items-center justify-between gap-3 py-1 text-[15px]">
              <span>Also block {name}</span>
              <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} className="w-5 h-5 accent-primary" />
            </label>
            <button className={`${primary} bg-primary hover:bg-primary-light`} onClick={doReport} disabled={!reason || busy}>
              {busy ? 'Sending…' : 'Send Report'}
            </button>
          </>
        )}

        {step === 'done' && (
          <>
            <h2 className="text-xl font-bold text-center mb-1">Done</h2>
            <p className="text-sm text-[#6b6b80] text-center mb-1.5">{doneMessage}</p>
            <button className={`${primary} bg-primary hover:bg-primary-light`} onClick={onClose}>OK</button>
          </>
        )}

        {error && <p role="alert" className="text-danger text-sm text-center">{error}</p>}
        {step !== 'done' && (
          <button className="text-[#9a9aaa] text-[15px] font-semibold py-2" onClick={onClose}>Cancel</button>
        )}
      </div>
    </div>
  );
}
