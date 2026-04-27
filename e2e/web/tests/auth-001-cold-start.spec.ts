import { test, expect } from '@playwright/test';
import { recordLifecycle, signInAsGuest } from './lifecycle';

/**
 * Scenario: auth-001 — Cold-start anonymous sign-in
 * Asserts the lobby renders and store.initialized fires.
 */
test('auth-001: cold-start renders lobby and emits store.initialized', async ({ page }) => {
  const events = recordLifecycle(page);
  await signInAsGuest(page);
  await events.waitFor('store.initialized');
  // signInAsGuest already verified "Start a Room" is visible.
  expect(events.last('store.initialized')).not.toBeNull();
});
