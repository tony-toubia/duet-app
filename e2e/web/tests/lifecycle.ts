import type { ConsoleMessage, Page } from '@playwright/test';
import { expect } from '@playwright/test';

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
  const recentConsole: string[] = [];
  const RECENT_LIMIT = 10;

  const handler = (msg: ConsoleMessage) => {
    const text = msg.text();
    const evt = parseLifecycle(text);
    if (evt) {
      events.push(evt);
    } else {
      // Keep a small ring buffer of non-lifecycle console output so failure
      // messages can show what the page was actually doing.
      recentConsole.push(`[${msg.type()}] ${text.slice(0, 200)}`);
      if (recentConsole.length > RECENT_LIMIT) recentConsole.shift();
    }
  };
  page.on('console', handler);

  return {
    all: () => [...events],
    last: (eventName: string) =>
      [...events].reverse().find((e) => e.event === eventName) ?? null,
    waitFor: async (eventName: string, timeoutMs = 15_000): Promise<LifecycleEvent> => {
      const deadline = Date.now() + timeoutMs;
      const existing = [...events].reverse().find((e) => e.event === eventName);
      if (existing) return existing;
      while (Date.now() < deadline) {
        await page.waitForTimeout(100);
        const found = [...events].reverse().find((e) => e.event === eventName);
        if (found) return found;
      }
      const url = page.url();
      const captured = events.map((e) => e.event).join(', ') || '(none)';
      const recent = recentConsole.join('\n  ') || '(none)';
      throw new Error(
        `Timed out after ${timeoutMs}ms waiting for lifecycle event "${eventName}".\n` +
          `URL: ${url}\n` +
          `Lifecycle events captured: ${captured}\n` +
          `Recent console (non-lifecycle):\n  ${recent}`
      );
    },
    detach: () => page.off('console', handler),
  };
}

/**
 * Navigate to /app and click through the AuthScreen as an anonymous guest.
 * Returns when the lobby is rendered. Use this at the start of any test
 * that needs to interact with the lobby or beyond.
 *
 * Race-based: whichever of {Continue as Guest, Start a Room} appears first
 * tells us where the auth state stands. If the lobby shows up first the
 * user is already signed in (cached from a previous run) and we skip the
 * guest click. Otherwise we click the button and wait for the lobby.
 */
export async function signInAsGuest(page: Page, path: string = '/app'): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });

  const guestBtn = page.getByRole('button', { name: /continue as guest/i });
  const lobby = page.getByText(/start a room/i).first();

  // Wait up to 20s for either the auth or lobby to render.
  await Promise.race([
    guestBtn.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => null),
    lobby.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => null),
  ]);

  // If the lobby is already visible we're cached-in; skip the click.
  if (await lobby.isVisible().catch(() => false)) return;

  // Otherwise the auth screen is up — click guest and wait for the lobby.
  await guestBtn.click();
  await expect(lobby).toBeVisible({ timeout: 20_000 });
}
