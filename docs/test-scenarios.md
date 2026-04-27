# Cross-Platform Test Scenarios

The canonical list of behaviours we care about lives in [`test-scenarios.yaml`](./test-scenarios.yaml). This README explains how to read and use it.

## Why a matrix and not a checklist

Manual checklists drift and don't compose. The matrix encodes:

- **Stable IDs** (`duet-002`, `bg-004`, ...) so a scenario can be referenced from a Maestro flow, a Playwright spec, a bug report, or a CI artifact without ambiguity.
- **Explicit pass/fail** so triage doesn't depend on tester intuition.
- **`gap_ref`** linking scenarios back to the parity-audit gap they verify, so when we change a fix we know which test guards it.
- **Suites** so the same source of truth produces a 10-min smoke run and a full pre-ship run.

## Severity ladder

| Tier | Meaning | Example |
|------|---------|---------|
| P0 | Blocker. App can't ship if this fails. | Two devices can't connect at all. |
| P1 | High. Reproducible regression in a primary flow. | Web answerer can't recover after host's tab is hidden. |
| P2 | Medium. Edge case or noticeable polish. | Bluetooth swap mid-call has a brief glitch. |
| P3 | Low. Aesthetic / nice-to-have. | User appears in their own friends list on web. |

## How to run

There is no automated runner yet — that's the next step. Today the matrix is consumed three ways:

1. **Manual device testing.** Pick a suite (`smoke` / `pre-ship` / `weekly-regression`) and walk the scenarios on real hardware. Record pass/fail per scenario id.
2. **Bug reports.** When filing a regression, reference the closest scenario id (e.g. "rc-002 fails on Safari"). If no scenario fits, add one.
3. **Future automation.** Each scenario will compile into a Maestro YAML flow (native) or a Playwright test (web). The id becomes the file name.

## Scenario shape

```yaml
- id: bg-004
  name: Web tab hidden then returned restores audio
  severity: P0
  gap_ref: "#1, #8"
  actors:
    - { role: host, platform: any }
    - { role: joiner, platform: web }
  preconditions: [duet-003 connected]
  steps:
    - Joiner switches to another browser tab for 60s
    - Both keep talking during the hidden window
    - Joiner switches back to Duet tab
  expected:
    - On return, joiner's audio resumes within 5s (ICE restart nudge fires)
    - "Reconnecting..." badge appears briefly, then "Connected"
  signals:
    - "[Room] Tab returned to foreground, nudging reconnect"
    - "[WebRTC] Connection state changed: connected" appears after the nudge
```

- **`actors`** lists the participants and their platforms. `accountSame: true` means a different role uses the same Firebase account as another role.
- **`preconditions`** can reference other scenario ids — those must pass first.
- **`steps`** are imperatives a tester (or automation) executes in order.
- **`expected`** are independently checkable assertions. All must pass for the scenario to pass.
- **`signals`** are stable log substrings or UI elements an automated harness can grep / assert. They make post-hoc triage feasible.

## Adding a scenario

1. Pick the right `feature` group, or add a new one.
2. Use the next available id: `<feature>-NNN`.
3. Set a severity. If you're unsure, P2.
4. If the scenario verifies a fix, add `gap_ref` pointing to the audit gap number.
5. Make every `expected` line independently checkable.
6. Prefer signals from existing log strings over inventing new ones — telemetry should be added separately and reused across scenarios.
