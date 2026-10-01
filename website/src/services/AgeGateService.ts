import { ageGateResult, AgeGateResult } from '@/lib/ageGate';

const STORAGE_KEY = 'duet_age_gate';
const VALID: AgeGateResult[] = ['under16', 'minor', 'adult', 'blocked'];

/**
 * Stores the age gate outcome in this browser: only the band (or
 * "blocked"), never the birth date.
 */
export const ageGateService = {
  getResult(): AgeGateResult | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw && (VALID as string[]).includes(raw) ? (raw as AgeGateResult) : null;
    } catch {
      return null;
    }
  },

  submit(birthMonth: number, birthYear: number): AgeGateResult {
    const result = ageGateResult(birthMonth, birthYear);
    try {
      localStorage.setItem(STORAGE_KEY, result);
    } catch {
      // Private mode: the gate is asked again next visit
    }
    return result;
  },
};
