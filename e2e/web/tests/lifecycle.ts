import type { ConsoleMessage, Page } from '@playwright/test';

/**
 * Helpers for asserting on [duet.lifecycle] events emitted by the web client.
 *
 * The events are produced by website/src/services/LifecycleLog.ts and have
 * the form: `[duet.lifecycle] event=<name> platform=web key=value ...`
 */

export type LifecycleEvent = {
  event: string;
  props: Record<string, string>;
  raw: string;
};

const PREFIX = '[duet.lifecycle] ';

export function parseLifecycle(text: string): LifecycleEvent | null {
  if (!text.startsWith(PREFIX)) return null;
  const body = text.slice(PREFIX.length).trim();
  const parts = body.split(/\s+/);
  const props: Record<string, string> = {};
  let event = '';
  for (const p of parts) {
    const eq = p.indexOf('=');
    if (eq < 0) continue;
    const k = p.slice(0, eq);
    const v = p.slice(eq + 1);
    if (k === 'event') event = v;
    else props[k] = v;
  }
  if (!event) return null;
  return { event, props, raw: text };
}

/**
 * Attach a recorder to a page that captures all lifecycle events as they fire.
 * Returns a getter so tests can inspect the timeline at any point.
 */
export function recordLifecycle(page: Page) {
  const events: LifecycleEvent[] = [];
  const handler = (msg: ConsoleMessage) => {
    const text = msg.text();
    const evt = parseLifecycle(text);
    if (evt) events.push(evt);
  };
  page.on('console', handler);
  return {
    all: () => [...events],
    last: (eventName: string) =>
      [...events].reverse().find((e) => e.event === eventName) ?? null,
    waitFor: async (eventName: string, timeoutMs = 15_000): Promise<LifecycleEvent> => {
      const deadline = Date.now() + timeoutMs;
      // Quick check
      const existing = [...events].reverse().find((e) => e.event === eventName);
      if (existing) return existing;
      // Poll
      while (Date.now() < deadline) {
        await page.waitForTimeout(100);
        const found = [...events].reverse().find((e) => e.event === eventName);
        if (found) return found;
      }
      throw new Error(
        `Timed out after ${timeoutMs}ms waiting for lifecycle event "${eventName}". ` +
          `Captured: ${events.map((e) => e.event).join(', ')}`
      );
    },
    detach: () => page.off('console', handler),
  };
}
