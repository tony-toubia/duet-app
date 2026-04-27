# Triage Protocol

How to hand a failing test run back to Claude (or any reviewer) so it can be diagnosed without re-deriving context.

## Run artifact layout

Every test run — manual, Maestro, Playwright, or CI — drops one folder under `runs/`. Put it in your local working tree (gitignored) or share it as a zip.

```
runs/
  2026-04-27T14-00-00Z__pre-ship/
    summary.json              # high-level pass/fail per scenario
    scenarios/
      bg-004/
        outcome.json          # pass | fail | flake, severity, duration
        host-logs.txt         # filtered to [duet.lifecycle] only
        joiner-logs.txt
        host-console.txt      # full unfiltered console (for context)
        joiner-console.txt
        host-screenshot.png   # final state on failure
        joiner-screenshot.png
        host-trace.zip        # Playwright trace if applicable
        network.har           # if recorded
      rc-002/
        ...
```

`summary.json` shape:

```json
{
  "runId": "2026-04-27T14-00-00Z__pre-ship",
  "suite": "pre-ship",
  "branch": "claude/cross-platform-device-testing-bN4CH",
  "commit": "281ea06",
  "platforms": { "host": "ios-18.2-iPad", "joiner": "chrome-127" },
  "totals": { "passed": 18, "failed": 1, "flake": 0 },
  "scenarios": [
    { "id": "auth-001", "outcome": "pass", "ms": 1240 },
    { "id": "bg-004",   "outcome": "fail", "ms": 31200, "firstFailure": "expected webrtc.nudge with reason=visibility, got nothing" }
  ]
}
```

## What "filtered logs" means

Test runners should grep `[duet.lifecycle]` from raw device logs and write it to `*-logs.txt`, keeping the unfiltered console in `*-console.txt`. This makes the timeline scannable without losing context. Example commands:

```bash
# Android
adb logcat -d | grep '\[duet.lifecycle\]' > host-logs.txt

# iOS device
xcrun devicectl device process logs --device <udid> com.duet.app | \
  grep '\[duet.lifecycle\]' > host-logs.txt

# Web (Playwright trace already structured; convert via codegen if needed)
```

## Prompt template — hand-off to Claude

Paste this when asking Claude to triage. Replace bracketed bits.

```
Failing test run: [run id]
Suite: [smoke | pre-ship | weekly-regression]
Branch / commit: [branch / sha]
Failed scenarios: [list of ids]

For each failure, I have:
- runs/[run id]/scenarios/[id]/outcome.json
- runs/[run id]/scenarios/[id]/{host,joiner}-logs.txt (filtered to lifecycle)
- runs/[run id]/scenarios/[id]/{host,joiner}-console.txt (full)
- runs/[run id]/scenarios/[id]/{host,joiner}-screenshot.png

The scenario definitions live in docs/test-scenarios.yaml. Their gap_ref
(if present) points to the parity audit I should NOT relitigate — those
are intentional fixes. CLAUDE.md and iOS-26-FIXES.md document other
intentional weirdness.

Please:
1. Classify each failure as: real regression / flake / scenario error /
   intentional behavior misclassified as failure.
2. For real regressions, identify the root cause and the smallest patch.
3. Skip flakes unless they're consistent across the last 3 runs.
4. Don't propose refactors or unrelated cleanup.

Tight, focused report.
```

## Classification rules

When triaging, sort each failure into exactly one bucket:

| Bucket | Meaning | Action |
|---|---|---|
| **Real regression** | Behavior changed; matches a prior-passing scenario. | Patch and add a test if not present. |
| **Flake** | Inconsistent across runs; often timing-sensitive. | Note. Fix only if it recurs in 3+ runs. |
| **Scenario error** | Scenario YAML is wrong or stale. | Fix the YAML. |
| **Intentional behavior** | The "failure" is actually correct per CLAUDE.md / iOS-26-FIXES.md / a documented audit gap. | Update the scenario `expected` or add a comment. |

If unsure, prefer **flake** over **regression** — false positives waste more time than false negatives. The weekly-regression suite catches anything chronic.

## Re-running a single scenario

```bash
# Maestro (single-device)
maestro test maestro/duet-001-create-room.yaml

# Playwright (web)
cd e2e/web && npx playwright test tests/bg-004-tab-visibility.spec.ts --headed
```

Both runners write into `runs/` if `RUN_ID` is set:

```bash
RUN_ID=$(date -u +%Y-%m-%dT%H-%M-%SZ)__investigate \
  maestro test maestro/duet-001-create-room.yaml
```
