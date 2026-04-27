# Playwright tests for the Duet web client

End-to-end tests for the [scenarios listed in `docs/test-scenarios.yaml`](../../docs/test-scenarios.yaml) that target the web app. Each spec file is named after the scenario id it covers.

## Why Playwright

- Multi-tab in a single test process gives us "two users in the same room" almost free — no second machine, no signaling against a real partner device.
- Synthetic mic via `--use-fake-device-for-media-stream` lets WebRTC actually run without real hardware. Audio quality isn't asserted (use ears for that), but the connection lifecycle and ICE state machine are.
- Captures `[duet.lifecycle]` events emitted by the web client; tests assert against those instead of brittle UI strings.

## Running

```bash
cd e2e/web
npm install
npx playwright install chromium

# Against a local Next.js dev server (must already be running on :3000):
DUET_WEB_URL=http://localhost:3000 npx playwright test

# Against a deployed preview:
DUET_WEB_URL=https://preview.getduet.app npx playwright test

# Single spec, headed (watch the browser):
npx playwright test --headed tests/duet-002-multi-tab.spec.ts
```

Reports land in `playwright-report/` after a run; `npm run report` opens it.

## Conventions

- One spec file per scenario id; the file name is the id.
- Always use `recordLifecycle(page)` to capture events; assert on lifecycle event names rather than `page.locator(text)` where possible.
- Avoid sleeps. Wait for either a lifecycle event or a UI element with an explicit timeout.

## Limitations

- Real network drop is hard to fake from Playwright; for ICE-restart scenarios we trigger the code path via synthetic offline/online events rather than network shaping.
- Voice round-trip is not asserted — synthetic mic produces a beep, not speech, and we'd need WebAudio analysis to confirm partner playback. That belongs in a perf suite, not E2E.
- Browsers throttle background tabs in real life. The visibility test fires a synthetic `visibilitychange`; verifying the actual throttling behavior requires a real user with a real tab and is covered by the manual scenario in `test-scenarios.yaml`.

## Adding a test

1. Pick a scenario id from `docs/test-scenarios.yaml`.
2. Create `tests/<id>.spec.ts`.
3. Use `recordLifecycle(page)` for the event timeline.
4. Assert on the `signals` listed in the scenario.
