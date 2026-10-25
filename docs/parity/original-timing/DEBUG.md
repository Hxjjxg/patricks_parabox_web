# Native input phase investigation — 2026-10-25

## Observations
- Native World.UpdateInner runs Controls.Update, PlayerMovementLogic, queued impulse, animation advance, AnyBlockMoving recomputation, then win timer/level advance.
- Existing frame captures record requested coroutine controls, not the Controls.Update-delivered sample.
- Earlier rapid-turn capture has count rising during a slide and the queued position change one update after landing.
- Earlier isolated held-win capture loads second_puzzle and advances upward without repress.
- Scope: read-only observer hooks; original game logic and production Web code remain untouched.

## Hypotheses
### H1 — prior-frame movement state delays impulse (ROOT HYPOTHESIS)
- Supports: source applies queued impulse before animation/AnyBlockMoving recomputation.
- Conflicts: screenshots alone cannot identify exact delivered control sample.
- Test: observe movement before/after, impulse before/after and update end for RIGHT40 UP40 NONE300. Confirm queued count increases before landing, landing has no impulse, next update applies it.

### H2 — coroutine delivery timing explains apparent acceptance
- Supports: requested controls can change after that frame update.
- Conflicts: source still permits queue acceptance during motion.
- Test: log actual controls after TimedInputPatch and correlate each later phase in the same native frame.

### H3 — load preserves held input but resets repeat state
- Supports: earlier held capture moves in second_puzzle; LoadLevel resets queue/win, not Movement dirs/dxLast/dyLast/counter.
- Conflicts: exact repeat state was not captured.
- Test: two isolated held-UP win runs; capture GoToLevel before/after, direction stack, repeat counter, blocked flag and next accepted move.

## Experiments
- Planned harness infrastructure: compact in-memory phase snapshots active only within timed captures. Each observed phase adds one read-only trace call; no movement or timing rule is changed.
- Experiments use the same existing capture path and compare phase order rather than screenshot indices.

### Results
- H1 confirmed in first-queue-phase-r40-u40-20261025: acceptance frame301/73.793ms, landing frame303/109.837ms, queued impulse frame304/126.501ms. Count rises at acceptance; release does not cancel.
- H2 explains why coroutine labels cannot be treated as delivered input, but does not explain away queue behavior. New hooks distinguish request from controls-delivered exactly.
- Competing-input capture confirms UP remains queued even when actual LEFT is delivered before application.
- H3 rejected in its reset-state portion: both held-win runs preserve Movement direction stack, last direction, blocked flag and repeat counter across GoToLevel. Held UP applies on the next update.
- WinCount begins on the animation landing update and accumulates the full landing delta, then loads when >=1.5. It does not begin at the winning impulse.
- Both isolated runs have equal before/after persisted-save SHA256 and three suppressed save calls.

## Root Cause
Native count/queue acceptance and actual motion occur at different update phases; native level load also preserves controller state. A Web implementation that collapses these phases or clears held-controller state on automatic level advance diverges.

## Fix
No production fix belongs to this investigation agent. Exact traces and conclusions were handed to the main agent, who owns controller changes/regressions and commits. The read-only observer infrastructure is retained to reproduce the evidence.

## Queued-action history follow-up

### Observations
- Queue acceptance reserves World.MoveCount but does not call TurnCompleted or clear future.
- Successful Impulse calls TurnCompleted: records the reserved count, clears future, and pushes history. A blocked impulse creates no turn and queue completion decrements World.MoveCount.
- Undo checks empty past first; otherwise it flushes the queue before popping the latest count-group. Restart flushes before building a count-zero restart turn. Redo does not flush; UndoInput clears queued state only when redo succeeds.

### Hypotheses
- H4 (root): queued successful action plus undo first commits the queue, then undoes that queued action; queued blocked action plus undo instead undoes the preceding successful action. Test the same first slide with successful UP versus blocked RIGHT reservations, followed by UNDO.
- H5: accepted pending input clears redo history early. Source conflicts: future.Clear only occurs on successful physical TurnCompleted. Test with future present, then pending input, then REDO before landing.
- H6: restart discards pending action. Source conflicts: explicit while(queue) executes it first. Test restart while queued, then undo restart to inspect restored position/history count.

### Experiment design
Add only read-only history stack fields and history method boundary trace calls to the existing observer infrastructure. Run short timed controls; no original gameplay or production Web rule is changed.

### History results
- H4 confirmed: successful queue is committed then undone; blocked queue rolls back the reserved count and undo removes the preceding success. Both exact method nesting and past/future arrays are captured.
- H5 rejected: pending acceptance preserves future[3]. Successful redo does not flush the queue; UndoInput clears it after restoring redo. With empty future, unsuccessful redo preserves queued UP until it executes.
- H6 rejected: restart first commits the queued success. Restart creates past[0,2,1]; undo restart restores the fully committed queued position/count2.
- Seven captures and PNG references are indexed in history-phase-summary.json. Assertions validate the observed stacks, counts, physical positions, redo cancellation, no-op redo, and absent history on blocked movement.

## Input boundary results
- Eight additional cases are indexed in input-boundary-replay.json with all301 actual delivered native update masks/deltas. Nominal25/95/105ms requests are not exact delivery times; actual undo delivery was59.407/117.034/134.934ms.
- Simultaneous Up+Right selects Right; Up+Down selects Down because newly pressed directions are appended in Up,Down,Left,Right visit order.
- Overlap/release reveals the older held direction but cannot replace an accepted queue. The original direction stack is not updated at all while undo/redo is held because PlayerMovementLogic returns first.
- A blocked held direction bumps once, reserves then rolls back its count, and waits for direction change. Release/re-press creates one new failed impulse without new history.

## Read-only render follow-up
- Renderer requested proof of border colors, filled walls and root1px asymmetry. Production renderer code was not edited by this agent.
- Managed argument-type hypothesis: native Internal_DrawTextureArguments.color is UnityEngine.Color, not Color32. Original CPU Color32 conversion is recorded separately as a candidate; the internal native vertex format remains unproved.
- Float-product hypothesis confirmed by native double fields at three sizes: root width exactly screenMin*float32(.82), without rounding the product to float32; odd screen centers use integer division. SetDrawRect entry pixels already contain the asymmetry, so it is not solely a later clipping artifact.
- Filled-wall hypothesis confirmed by runtime1x1 subSize and source FillLevelWithWalls ResizeAndClear(1,1). Actual wall tickets paint over the backing color.
- Exact coordinates/colors and same-frame screenshots are in native-render-submission-summary.json. Additional original GPU readbacks preserve WallBig/flip, configured keyboard textures, MouseZoom and17 specifically requested eye/button/gradient/movement-icon fields, with hashes.
- Partial27-file EXTRAS attempt is cataloged as valid-partial and superseded by the complete31-file capture; no missing keyboard texture is claimed as captured in the partial run.

## 2026-10-25 held-history and fresh player draw state

- Added read-only `undoDirection` and `playerDrawFlags` phase fields.
- Captured four held-history scenarios (581 actual updates), including 58
  empty-stack attempts in the long hold and .04 repeat-spacing floor.
- `scripts/parity-original/summarize-history.py` validates all 581 native
  spacing/deadline/direction transitions exactly after float32 conversion;
  writes `history-repeat-replay.json` and `history-repeat-summary.json`.
- Fresh isolated first-to-second automatic load has DrawIsPlayer=true at
  GoToLevel postfix and filled dark eyes in same-frame `frame-0093.png`.
  The persisted save hash is unchanged and prior in-memory save restored.
- Six added manifest entries bring the visual scenario count to 66 plus
  five GPU datasets. All 713 new PNG headers/dimensions checked at 800x600.
- Final observer build has zero warnings/errors; repo/native source hashes
  match and deployed/built DLL hashes match. Logs are clean.
- Debug process 26568 restored to settled third_puzzle at 800x600 in
  `third-restored-history-flags-800x600-20261025`; no timed controls held.
