import { test, expect } from '@playwright/test';
import { recordLifecycle, signInAsGuest } from './lifecycle';

/**
 * Scenario: rc-002 — Web answerer can recover when host's tab is hidden
 *
 * Pre-fix the answerer was hard-gated against initiating ICE restart, so a
 * host whose tab went idle would leave the joiner stuck "Reconnecting"
 * forever. We assert that webrtc.ice.restart fires from the joiner's side.
 *
 * Note: this test exercises the JS path only. A real network drop is hard
 * to simulate from Playwright — the assertion here is that the answerer
 * code path is reachable, not that ICE transports actually re-converge.
 */
test('rc-002: joiner can initiate ICE restart', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const joinerCtx = await browser.newContext();
  try {
    const host = await hostCtx.newPage();
    const joiner = await joinerCtx.newPage();
    const hostEvents = recordLifecycle(host);
    const joinerEvents = recordLifecycle(joiner);

    await signInAsGuest(host);
    await hostEvents.waitFor('store.initialized');
    await host.getByText(/start a room/i).first().click();
    const created = await hostEvents.waitFor('room.created', 15_000);
    const roomCode = created.props.roomCode;

    await signInAsGuest(joiner, `/app/room/${roomCode}`);
    await joinerEvents.waitFor('room.joined');

    // Wait for initial connection.
    await joinerEvents.waitFor('webrtc.state', 30_000);

    // Force the joiner's peer connection into a non-connected state by
    // closing it locally; the connectionstatechange listener will fire and
    // attemptIceRestart should run regardless of isOfferer.
    await joiner.evaluate(() => {
      // Find any RTCPeerConnection in the page and close it
      // by triggering an offline event. The application's online/offline
      // listener will attempt to nudge.
      window.dispatchEvent(new Event('offline'));
      window.dispatchEvent(new Event('online'));
    });

    // We expect an ICE restart attempt within 10s, regardless of which side
    // is the offerer.
    const evt = await joinerEvents.waitFor('webrtc.ice.restart', 10_000);
    expect(Number(evt.props.attempt)).toBeGreaterThanOrEqual(1);
  } finally {
    await hostCtx.close();
    await joinerCtx.close();
  }
});
