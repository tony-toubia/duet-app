import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.DUET_WEB_URL ?? 'http://localhost:3000';

/**
 * Playwright config tuned for the Duet web client.
 *
 * --use-fake-device-for-media-stream + --use-fake-ui-for-media-stream let
 * WebRTC initialize headlessly with a synthetic mic, so the connection
 * lifecycle and ICE state machine can be exercised end-to-end without real
 * audio hardware. Round-trip voice is not asserted — that requires real ears.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // tests sometimes share a base room code
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            '--autoplay-policy=no-user-gesture-required',
          ],
        },
        permissions: ['microphone'],
      },
    },
  ],
});
