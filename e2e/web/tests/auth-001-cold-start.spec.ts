import { test, expect } from '@playwright/test';
import { recordLifecycle } from './lifecycle';

/**
 * Scenario: auth-001 — Cold-start anonymous sign-in
 * Asserts the lobby renders and store.initialized fires.
 */
test('auth-001: cold-start renders lobby and emits store.initialized', async ({ page }) => {
  const events = recordLifecycle(page);
  await page.goto('/app');
  await events.waitFor('store.initialized');
  // Lobby controls visible — using the same labels the mobile lobby uses.
  await expect(page.getByText(/start a room|create.*room/i).first()).toBeVisible({ timeout: 10_000 });
});
