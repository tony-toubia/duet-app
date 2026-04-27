# Maestro Flows

Single-device E2E flows for the scenarios listed in [`docs/test-scenarios.yaml`](../docs/test-scenarios.yaml). File names map 1:1 to scenario ids so a failing run points directly at the matrix.

## Why Maestro

- Same YAML drives iOS Simulator, Android Emulator, and real devices.
- Cheap to write, easy to diff, runs in CI.
- Two-device scenarios are out of scope here — see [`e2e/web/`](../e2e/web/) for Playwright multi-tab tests, or coordinate two Maestro runs from the orchestrator (TBD).

## Prerequisites

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

For physical devices: a debug or release build of `com.duet.app` installed and signed in (the flows assume an existing session unless they call `clearState: true`).

## Running

```bash
# Single flow on the default connected device:
maestro test maestro/smoke-cold-start.yaml

# All flows:
maestro test maestro/

# On a specific device:
maestro --device <udid> test maestro/duet-001-create-room.yaml
```

## Capturing telemetry during a run

The flows assert UI; the lifecycle events are observed separately. Run a tail in a parallel terminal:

```bash
# Android
adb logcat | grep '\[duet.lifecycle\]'

# iOS Simulator
xcrun simctl spawn booted log stream --level debug --predicate 'eventMessage CONTAINS "duet.lifecycle"'

# iOS device
xcrun devicectl device process launch --console --device <udid> com.duet.app | grep duet.lifecycle
```

Expected events for each flow are documented in the scenario's `signals` field in `test-scenarios.yaml`.

## Notes on selectors

Flows match on visible text rather than testIDs. Reasons:

- The codebase doesn't currently expose stable `testID` props on most controls.
- Text selectors break with copy changes, but those changes are visible in code review and easy to update here.

If a flow becomes flaky because of overlay timing, the typical fix is to add `waitForAnimationToEnd` or bump a `timeout` rather than introduce testIDs piecemeal — that's a separate codebase pass.

## Scenarios not covered here

Two-device, mesh, network-drop, and lock-screen scenarios need orchestration across multiple devices or system-level inputs. They live in:

- Cross-device orchestration: TBD (planned: a Node script that drives `maestro test` + `adb` + `xcrun` in parallel).
- Web visibility / network: see Playwright tests in [`../e2e/web/`](../e2e/web/).
