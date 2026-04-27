import { Platform } from 'react-native';

type LifecycleProps = Record<string, string | number | boolean | null | undefined>;

/**
 * Structured lifecycle event for cross-platform parity testing.
 *
 * Format: [duet.lifecycle] event=<name> platform=<ios|android|web> [k=v ...]
 *
 * Same prefix on iOS, Android, and web means the test harness can grep one
 * pattern across logcat, Xcode console, and browser DevTools. See
 * docs/test-scenarios.yaml for which scenarios assert which events.
 */
export function lifecycle(event: string, props?: LifecycleProps): void {
  const parts: string[] = [`event=${event}`, `platform=${Platform.OS}`];
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null) continue;
      const value = typeof v === 'string' ? v : String(v);
      parts.push(`${k}=${value}`);
    }
  }
  console.log(`[duet.lifecycle] ${parts.join(' ')}`);
}
