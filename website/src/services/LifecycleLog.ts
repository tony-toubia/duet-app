type LifecycleProps = Record<string, string | number | boolean | null | undefined>;

/**
 * Structured lifecycle event for cross-platform parity testing.
 *
 * Format: [duet.lifecycle] event=<name> platform=web [k=v ...]
 *
 * Mirrors src/services/LifecycleLog.ts on the mobile side so the same grep
 * works across logcat / Xcode console / browser DevTools.
 */
export function lifecycle(event: string, props?: LifecycleProps): void {
  const parts: string[] = [`event=${event}`, `platform=web`];
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null) continue;
      const value = typeof v === 'string' ? v : String(v);
      parts.push(`${k}=${value}`);
    }
  }
  console.log(`[duet.lifecycle] ${parts.join(' ')}`);
}
