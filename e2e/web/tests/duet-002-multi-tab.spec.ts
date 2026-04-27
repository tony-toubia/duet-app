import { test, expect, BrowserContext } from '@playwright/test';
import { recordLifecycle } from './lifecycle';

/**
 * Scenario: duet-002 — Joiner enters code and connects (web + web)
 *
 * Two independent browser contexts simulate two users in the same browser
 * process. Each gets its own anonymous Firebase identity. We assert that
 * webrtc.state=connected fires on both sides within 30s.
 */
test('duet-002: two web tabs connect end-to-end', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const joinerCtx = await browser.newContext();
  try {
    const host = await hostCtx.newPage();
    const joiner = await joinerCtx.newPage();
    const hostEvents = recordLifecycle(host);
    const joinerEvents = recordLifecycle(joiner);

    // Host opens app and creates a room.
    await host.goto('/app');
    await hostEvents.waitFor('store.initialized');
    await host.getByText(/start a room/i).first().click();
    const created = await hostEvents.waitFor('room.created', 15_000);
    const roomCode = created.props.roomCode;
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);

    // Joiner opens deep link to the same room.
    await joiner.goto(`/app/room/${roomCode}`);
    await joinerEvents.waitFor('room.joined', 15_000);

    // Both sides must reach connected.
    await Promise.all([
      hostEvents.waitFor('webrtc.state', 30_000).then((e) => {
        expect(e.props.state).toMatch(/connected|connecting/);
      }),
      joinerEvents.waitFor('webrtc.state', 30_000).then((e) => {
        expect(e.props.state).toMatch(/connected|connecting/);
      }),
    ]);

    // Definitive: both must see the connected state at least once.
    const hostConnected = await waitForState(host, hostEvents, 'connected', 30_000);
    const joinerConnected = await waitForState(joiner, joinerEvents, 'connected', 30_000);
    expect(hostConnected).toBe(true);
    expect(joinerConnected).toBe(true);
  } finally {
    await hostCtx.close();
    await joinerCtx.close();
  }
});

async function waitForState(
  _page: any,
  events: ReturnType<typeof recordLifecycle>,
  state: string,
  timeoutMs: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const recent = events
      .all()
      .filter((e) => e.event === 'webrtc.state')
      .find((e) => e.props.state === state);
    if (recent) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}
