/**
 * Age gate logic, shared by the app and (as a copy) the website.
 *
 * Duet is for people 13 and over. The gate asks for birth month and year
 * on a neutral screen (it doesn't reveal the cut-off), keeps only the
 * resulting age band, never the birth date, and remembers a "too young"
 * result so the answer can't simply be changed and resubmitted.
 */
export type AgeBand = 'under16' | 'minor' | 'adult';
export type AgeGateResult = AgeBand | 'blocked';

export const MINIMUM_AGE = 13;

/**
 * Youngest age the person can be, given birth month (1-12) and year.
 * Assumes the birthday falls on the last day of the month, so someone
 * born this month counts as not having had their birthday yet.
 */
export function minimumAge(birthMonth: number, birthYear: number, now: Date = new Date()): number {
  const months = (now.getFullYear() - birthYear) * 12 + (now.getMonth() + 1 - birthMonth);
  // Not yet a full month past the birthday month: birthday may be ahead
  return Math.floor((months - 1) / 12);
}

export function ageGateResult(birthMonth: number, birthYear: number, now: Date = new Date()): AgeGateResult {
  if (!Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12) throw new Error('Invalid month');
  if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > now.getFullYear()) throw new Error('Invalid year');
  const age = minimumAge(birthMonth, birthYear, now);
  if (age < MINIMUM_AGE) return 'blocked';
  if (age < 16) return 'under16';
  if (age < 18) return 'minor';
  return 'adult';
}
