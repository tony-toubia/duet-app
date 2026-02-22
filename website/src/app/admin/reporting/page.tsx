'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchReportingMonths, fetchReportingCampaigns } from '@/services/AdminService';
import { Spinner } from '@/components/ui/Spinner';
import { AnimatedPageIcon } from '@/components/admin/AnimatedPageIcon';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface MonthEntry {
  year: number;
  month: number;
  count: number;
}

interface ReportData {
  campaigns: any[];
  totals: {
    totalTargeted: number;
    emailsSent: number;
    emailsFailed: number;
    pushSent: number;
    pushFailed: number;
    campaignCount: number;
  };
}

export default function ReportingPage() {
  const [months, setMonths] = useState<MonthEntry[]>([]);
  const [isLoadingMonths, setIsLoadingMonths] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  useEffect(() => {
    fetchReportingMonths()
      .then((data) => setMonths(data.months))
      .catch(console.error)
      .finally(() => setIsLoadingMonths(false));
  }, []);

  const loadReport = useCallback(async (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
    setIsLoadingReport(true);
    try {
      const data = await fetchReportingCampaigns(year, month);
      setReportData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingReport(false);
    }
  }, []);

  // Load current month on mount
  useEffect(() => {
    loadReport(new Date().getFullYear(), new Date().getMonth());
  }, [loadReport]);

  // Group months by year for sidebar folder view
  const yearGroups = months.reduce<Record<number, MonthEntry[]>>((acc, m) => {
    if (!acc[m.year]) acc[m.year] = [];
    acc[m.year].push(m);
    return acc;
  }, {});
  const sortedYears = Object.keys(yearGroups)
    .map(Number)
    .sort((a, b) => b - a);

  // Always include current year/month even if no campaigns yet
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  if (!yearGroups[currentYear]) {
    yearGroups[currentYear] = [{ year: currentYear, month: currentMonth, count: 0 }];
    if (!sortedYears.includes(currentYear)) sortedYears.unshift(currentYear);
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <AnimatedPageIcon name="reporting" />
        <h1 className="text-2xl font-bold text-white">Reporting</h1>
      </div>

      <div className="flex gap-6">
        {/* Month/Year sidebar */}
        <div className="w-48 flex-shrink-0">
          {isLoadingMonths ? (
            <Spinner size="sm" />
          ) : (
            <nav className="space-y-3">
              {sortedYears.map((year) => (
                <div key={year}>
                  <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                    {year}
                  </h3>
                  <div className="space-y-0.5">
                    {yearGroups[year]
                      .sort((a, b) => b.month - a.month)
                      .map((m) => {
                        const isActive = m.year === selectedYear && m.month === selectedMonth;
                        return (
                          <button
                            key={`${m.year}-${m.month}`}
                            onClick={() => loadReport(m.year, m.month)}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                              isActive
                                ? 'bg-primary/20 text-primary'
                                : 'text-text-muted hover:bg-glass hover:text-white'
                            }`}
                          >
                            {MONTH_NAMES[m.month]}
                            {m.count > 0 && (
                              <span className="ml-1.5 text-xs opacity-60">({m.count})</span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </nav>
          )}
        </div>

        {/* Main report area */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-white mb-4">
            {MONTH_NAMES[selectedMonth]} {selectedYear}
          </h2>

          {isLoadingReport ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : reportData ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                <MetricCard label="Campaigns" value={reportData.totals.campaignCount} />
                <MetricCard label="Targeted" value={reportData.totals.totalTargeted} />
                <MetricCard
                  label="Emails Sent"
                  value={reportData.totals.emailsSent}
                  sub={reportData.totals.emailsFailed > 0 ? `${reportData.totals.emailsFailed} failed` : undefined}
                />
                <MetricCard
                  label="Push Sent"
                  value={reportData.totals.pushSent}
                  sub={reportData.totals.pushFailed > 0 ? `${reportData.totals.pushFailed} failed` : undefined}
                />
                <MetricCard
                  label="Delivery Rate"
                  value={
                    reportData.totals.emailsSent + reportData.totals.pushSent > 0
                      ? `${Math.round(
                          ((reportData.totals.emailsSent + reportData.totals.pushSent) /
                            (reportData.totals.emailsSent +
                              reportData.totals.emailsFailed +
                              reportData.totals.pushSent +
                              reportData.totals.pushFailed || 1)) *
                            100
                        )}%`
                      : '—'
                  }
                />
              </div>

              {/* Campaign table */}
              {reportData.campaigns.length > 0 ? (
                <div className="bg-surface rounded-xl border border-glass-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-glass-border text-left">
                        <th className="px-4 py-3 text-text-muted font-medium">Campaign</th>
                        <th className="px-4 py-3 text-text-muted font-medium">Sent</th>
                        <th className="px-4 py-3 text-text-muted font-medium">Channels</th>
                        <th className="px-4 py-3 text-text-muted font-medium text-right">Targeted</th>
                        <th className="px-4 py-3 text-text-muted font-medium text-right">Email</th>
                        <th className="px-4 py-3 text-text-muted font-medium text-right">Push</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.campaigns.map((c: any) => (
                        <tr key={c.id} className="border-b border-glass-border/50 hover:bg-glass/30">
                          <td className="px-4 py-3">
                            <Link
                              href={`/admin/campaigns/${c.id}`}
                              className="text-white hover:text-primary transition-colors"
                            >
                              {c.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-text-muted">
                            {new Date(c.sentAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {c.channels?.map((ch: string) => (
                                <span
                                  key={ch}
                                  className="px-1.5 py-0.5 rounded text-xs bg-glass text-text-muted"
                                >
                                  {ch}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-white font-mono">
                            {c.results?.totalTargeted ?? 0}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {c.channels?.includes('email') ? (
                              <span>
                                <span className="text-green-400">{c.results?.emailsSent ?? 0}</span>
                                {(c.results?.emailsFailed ?? 0) > 0 && (
                                  <span className="text-red-400 ml-1">/ {c.results.emailsFailed}</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-text-muted">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {c.channels?.includes('push') ? (
                              <span>
                                <span className="text-green-400">{c.results?.pushSent ?? 0}</span>
                                {(c.results?.pushFailed ?? 0) > 0 && (
                                  <span className="text-red-400 ml-1">/ {c.results.pushFailed}</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-text-muted">
                  No campaigns sent in {MONTH_NAMES[selectedMonth]} {selectedYear}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-surface rounded-xl border border-glass-border p-4">
      <p className="text-xs text-text-muted uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-red-400 mt-0.5">{sub}</p>}
    </div>
  );
}
