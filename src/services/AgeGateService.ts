import AsyncStorage from '@react-native-async-storage/async-storage';
import { ageGateResult, AgeBand, AgeGateResult } from '@/lib/ageGate';

const STORAGE_KEY = '@duet_age_gate';

/**
 * Stores the age gate outcome on the device: only the band (or "blocked"),
 * never the birth date.
 */
class AgeGateService {
  private cached: AgeGateResult | null | undefined;

  async getResult(): Promise<AgeGateResult | null> {
    if (this.cached !== undefined) return this.cached;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const valid: AgeGateResult[] = ['under16', 'minor', 'adult', 'blocked'];
      this.cached = raw && (valid as string[]).includes(raw) ? (raw as AgeGateResult) : null;
    } catch {
      this.cached = null;
    }
    return this.cached;
  }

  async submit(birthMonth: number, birthYear: number): Promise<AgeGateResult> {
    const result = ageGateResult(birthMonth, birthYear);
    this.cached = result;
    await AsyncStorage.setItem(STORAGE_KEY, result).catch(() => {});
    return result;
  }

  /** Band for ad configuration; anyone not yet through the gate is treated as a minor. */
  async getAdAgeBand(): Promise<AgeBand> {
    const result = await this.getResult();
    return result === 'adult' || result === 'minor' || result === 'under16' ? result : 'under16';
  }
}

export const ageGateService = new AgeGateService();
