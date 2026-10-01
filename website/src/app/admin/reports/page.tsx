'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchReports, resolveReport, reinstateUser } from '@/services/AdminService';
import { Spinner } from '@/components/ui/Spinner';

type Filter = 'open' | 'resolved' | 'all';

interface Report {
  id: string;
  reporterUid: string;
  reporterName: string;
  reportedUid: string;
  reportedName: string;
  reportedDisabled: boolean;
  reason: string;
  context: string;
  details?: string;
  roomCode?: string;
  createdAt: number;
  status: string;
  resolution?: string;
  resolutionNote?: string;
}

const URGENT = new Set(['underage', 'self_harm']);

/**
 * Safety reports filed from the app. "Suspend" disables the reported
 * account's sign-in (Firebase Auth) and signs them out; "Reinstate" undoes
 * it. Anonymous guests can start a new guest account, so suspension is
 * mainly effective for full accounts.
 */
export default function ReportsPage() {
  const [filter, setFilter] = useState<Filter>('open');
  const [reports, setReports] = useState<Report[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReports(filter);
      setReports(data.reports);
      setReasons(data.reasons);
    } catch (e: any) {
      setError(e?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (r: Report, resolution: 'dismissed' | 'warned' | 'suspended') => {
    if (resolution === 'suspended' && !confirm(`Suspend ${r.reportedName}? They will be signed out and unable to sign in.`)) return;
    setBusyId(r.id);
    try {
      await resolveReport(r.id, resolution, notes[r.id] || '');
      await load();
    } catch (e: any) {
      alert(e?.message || 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const reinstate = async (r: Report) => {
    if (!confirm(`Reinstate ${r.reportedName}?`)) return;
    setBusyId(r.id);
    try {
      await reinstateUser(r.reportedUid);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-white mb-1">Safety Reports</h1>
      <p className="text-sm text-text-muted mb-6">
        Reports from users. Urgent reasons (possible under-13 user, self-harm) are emailed with [URGENT] and should be handled first.
      </p>

      <div className="flex gap-2 mb-6">
        {(['open', 'resolved', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
              filter === f ? 'bg-primary text-white' : 'bg-surface text-text-muted border border-glass-border'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : error ? (
        <p className="text-danger">{error}</p>
      ) : reports.length === 0 ? (
        <p className="text-text-muted">No {filter === 'all' ? '' : filter} reports.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {reports.map((r) => (
            <div key={r.id} className="bg-surface rounded-xl border border-glass-border p-4 text-sm text-white">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {URGENT.has(r.reason) && <span className="bg-danger text-white text-xs font-bold rounded px-2 py-0.5">URGENT</span>}
                <span className="font-semibold">{reasons[r.reason] || r.reason}</span>
                <span className="text-text-muted">· {new Date(r.createdAt).toLocaleString()}</span>
                <span className="text-text-muted">· {r.context}{r.roomCode ? ` (room ${r.roomCode})` : ''}</span>
                <span className="ml-auto text-xs uppercase tracking-wide text-text-muted">
                  {r.status}{r.resolution ? `: ${r.resolution}` : ''}
                </span>
              </div>
              <p>
                <span className="text-text-muted">Reported:</span> {r.reportedName}{' '}
                <code className="text-xs text-text-muted">{r.reportedUid}</code>
                {r.reportedDisabled && <span className="ml-2 text-danger font-semibold">suspended</span>}
              </p>
              <p>
                <span className="text-text-muted">By:</span> {r.reporterName}{' '}
                <code className="text-xs text-text-muted">{r.reporterUid}</code>
              </p>
              {r.details && <p className="mt-2 whitespace-pre-wrap bg-black/20 rounded-lg p-3">{r.details}</p>}
              {r.resolutionNote && <p className="mt-2 text-text-muted">Note: {r.resolutionNote}</p>}

              {r.status === 'open' && (
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <input
                    value={notes[r.id] || ''}
                    onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                    placeholder="Internal note (optional)"
                    className="flex-1 min-w-[200px] px-3 py-2 bg-background border border-glass-border rounded-lg text-white text-sm"
                  />
                  <button disabled={busyId === r.id} onClick={() => act(r, 'dismissed')} className="px-3 py-2 rounded-lg bg-glass border border-glass-border">Dismiss</button>
                  <button disabled={busyId === r.id} onClick={() => act(r, 'warned')} className="px-3 py-2 rounded-lg bg-glass border border-glass-border">Mark warned</button>
                  <button disabled={busyId === r.id} onClick={() => act(r, 'suspended')} className="px-3 py-2 rounded-lg bg-danger text-white font-semibold">Suspend user</button>
                </div>
              )}
              {r.reportedDisabled && (
                <button disabled={busyId === r.id} onClick={() => reinstate(r)} className="mt-3 px-3 py-2 rounded-lg bg-glass border border-glass-border">
                  Reinstate user
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
