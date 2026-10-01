import { ageGateResult, minimumAge } from '../ageGate';

const now = new Date(2026, 9, 1); // 1 October 2026

describe('age gate', () => {
  it('blocks under-13s', () => {
    expect(ageGateResult(1, 2015, now)).toBe('blocked'); // 11
    expect(ageGateResult(9, 2013, now)).toBe('under16'); // turned 13 in September
  });

  it('treats someone born this month as not yet a year older', () => {
    expect(minimumAge(10, 2013, now)).toBe(12);
    expect(ageGateResult(10, 2013, now)).toBe('blocked');
    expect(ageGateResult(11, 2013, now)).toBe('blocked');
  });

  it('assigns bands at 16 and 18', () => {
    expect(ageGateResult(9, 2010, now)).toBe('minor'); // 16
    expect(ageGateResult(10, 2010, now)).toBe('under16'); // may still be 15
    expect(ageGateResult(9, 2008, now)).toBe('adult'); // 18
    expect(ageGateResult(12, 2008, now)).toBe('minor'); // still 17
    expect(ageGateResult(6, 1980, now)).toBe('adult');
  });

  it('rejects impossible input', () => {
    expect(() => ageGateResult(0, 2000, now)).toThrow();
    expect(() => ageGateResult(13, 2000, now)).toThrow();
    expect(() => ageGateResult(5, 1800, now)).toThrow();
    expect(() => ageGateResult(5, 2030, now)).toThrow();
    expect(() => ageGateResult(1.5, 2000, now)).toThrow();
  });
});
