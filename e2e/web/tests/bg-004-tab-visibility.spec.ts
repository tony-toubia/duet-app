import { test, expect } from '@playwright/test';
import { recordLifecycle } from './lifecycle';

/**
 * Scenario: bg-004 — Web tab hidden then returned restores audio
 * Verifies the visibility nudge implemented in RoomScreen + WebRTCService.
 *
 * Real browsers throttle background tabs heavily; here we simulate the
 * visibility transition by dispatching the same events the browser would.
 * The assertion is that webrtc.nudge with reason=visibility fires when the
 * tab returns to visible.
 */
test('bg-004: visibility return triggers reconnect nudge', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const joinerCtx = await browser.newContext();
  try {
    const host = await hostCtx.newPage();
    const joiner = await joinerCtx.newPage();
    const hostEvents = recordLifecycle(host);
    const joinerEvents = recordLifecycle(joiner);

    await host.goto('/app');
    await hostEvents.waitFor('store.initialized');
    await host.getByText(/start a room/i).first().click();
    const created = await hostEvents.waitFor('room.created', 15_000);
    const roomCode = created.props.roomCode;

    await joiner.goto(`/app/room/${roomCode}`);
    await joinerEvents.waitFor('room.joined');

    // Wait for initial connection on the joiner side.
    await joinerEvents.waitFor('webrtc.state');

    // Simulate tab going hidden, then visible.
    await joiner.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await joiner.waitForTimeout(2_000);
    await joiner.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    const nudge = await joinerEvents.waitFor('webrtc.nudge', 5_000);
    expect(nudge.props.reason).toBe('visibility');
  } finally {
    await hostCtx.close();
    await joinerCtx.close();
  }
});
