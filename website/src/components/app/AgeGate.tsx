'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ageGateService } from '@/services/AgeGateService';
import type { AgeGateResult } from '@/lib/ageGate';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Neutral age screen shown once per browser, before sign-in. It asks for
 * birth month and year without hinting at the cut-off.
 */
export function AgeGate({ onDone }: { onDone: (result: AgeGateResult) => void }) {
  const [month, setMonth] = useState<number | null>(null);
  const [year, setYear] = useState('');
  const [error, setError] = useState<string | null>(null);

  const yearNum = Number(year);
  const valid = month !== null && /^\d{4}$/.test(year) && yearNum >= 1900 && yearNum <= new Date().getFullYear();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || month === null) return;
    try {
      onDone(ageGateService.submit(month, yearNum));
    } catch {
      setError('Please check the date and try again.');
    }
  };

  return (
    <div className="min-h-screen-safe bg-background text-text-main flex items-center justify-center px-5 py-10">
      <form onSubmit={submit} className="w-full max-w-sm flex flex-col gap-3">
        <h1 className="text-3xl font-bold text-center">Welcome to Duet</h1>
        <p className="text-text-muted text-center text-lg mb-3">When were you born?</p>

        <fieldset>
          <legend className="text-xs font-semibold tracking-wide text-text-muted mb-2">MONTH</legend>
          <div className="grid grid-cols-4 gap-2">
            {MONTHS.map((m, i) => (
              <button
                type="button"
                key={m}
                aria-pressed={month === i + 1}
                onClick={() => setMonth(i + 1)}
                className={`py-3 rounded-xl border ${
                  month === i + 1 ? 'border-primary bg-primary/25 font-bold' : 'border-glass-border bg-glass'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="text-xs font-semibold tracking-wide text-text-muted mt-2" htmlFor="birth-year">YEAR</label>
        <input
          id="birth-year"
          inputMode="numeric"
          autoComplete="bday-year"
          placeholder="YYYY"
          maxLength={4}
          value={year}
          onChange={(e) => { setYear(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(null); }}
          className="border border-glass-border bg-glass rounded-xl py-3.5 px-4 text-lg tracking-widest outline-none focus:border-primary"
        />
        {error && <p role="alert" className="text-danger text-sm">{error}</p>}

        <button
          type="submit"
          disabled={!valid}
          className="mt-4 bg-primary text-white rounded-full py-4 font-bold text-base disabled:opacity-40"
        >
          Continue
        </button>
        <p className="text-text-muted text-sm text-center mt-2">
          We use this only to keep Duet age-appropriate. We don&apos;t store your birth date.
        </p>
        <Link href="/privacy" className="text-primary text-sm text-center">Privacy Policy</Link>
      </form>
    </div>
  );
}

export function AgeBlocked() {
  return (
    <div className="min-h-screen-safe bg-background text-text-main flex flex-col items-center justify-center px-8 gap-4 text-center">
      <h1 className="text-3xl font-bold">Sorry, you can&apos;t use Duet</h1>
      <p className="text-text-muted text-lg">Duet isn&apos;t available to you based on the information you gave.</p>
      <a href="mailto:hello@getduet.app" className="text-primary">Questions? hello@getduet.app</a>
    </div>
  );
}
