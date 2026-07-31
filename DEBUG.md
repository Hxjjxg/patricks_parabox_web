# Gameplay Debug Journal

## Observations

### Ordered player-block transaction

- Environment: Windows, TypeScript 7.0.2, Vitest 4.1.10, PixiJS 8.19.0.
- Minimal reproduction candidate: original `multi_order_0` level, where one
  human player's input drives four player blocks in their defined order.
- `GameController.impulse` iterates every player block and calls
  `MovementEngine.impulse` separately.
- Every successful `MovementEngine.impulse` starts and commits its own history
  turn, and `History.commit` increments `world.moveCount`.
- Original `World.PlayerMovementLogic` increments `MoveCount` once, then uses
  `PlayerOrder` to queue every player block belonging to that one action. The
  original C# field is named `multiPlayerQueued`: this means multiple in-world
  player blocks controlled by one human player, not a network or four-human
  multiplayer mode. Ordinary boxes are absent from this queue and move only
  through pushing. Original
  `UndoManager` groups those player-block sub-turns by the shared move count.
- Single-player movement, blocked bumps, and single-turn undo/redo already pass.

## Hypotheses

### H1: Per-block commits incorrectly count one keyboard input multiple times (ROOT HYPOTHESIS)

- Supports: the controller calls the only commit-owning API once per player block;
  `History.commit` unconditionally increments the count.
- Conflicts: none.
- Test: apply one input in `multi_order_0` and assert the count is one.

### H2: Player-block enumeration order differs from the original

- Supports: sequential player-block resolution is order-sensitive.
- Conflicts: `WorldModel.computeBlockLists` already sorts by `playerOrder`, as
  the original does.
- Test: assert the fixture's player orders are `[0, 1, 2, 3]`.

### H3: Undo grouping, rather than counting, is the only faulty layer

- Supports: the original stores one sub-turn per moved player.
- Conflicts: the current world count visibly increments in every sub-turn, so
  undo grouping alone cannot repair the displayed count.
- Test: inspect `history.past` and `world.moveCount` after the reproduction.

## Experiments

### E1: Run `multi_order_0` through the old per-player-block loop

- Change: temporary four-line Vitest reproduction; removed immediately after
  the run.
- Prediction: H1 is confirmed if one upward input produces `moveCount === 4`.
- Result: **confirmed**. Vitest reported `expected 4 to be 1`; the four
  player-block moves happened, and each successful sub-impulse committed its
  own count.

## Root Cause

The controller modeled one directional input over several queued player-block
moves as several independent logical inputs because `History.commit` owned the
move-count increment instead of accepting the shared count assigned by the
input coordinator.

## Fix

Implemented `MovementEngine.applyDirectionalInput` as the input coordinator.
It resolves the marked blocks dynamically in `playerOrder`, commits every
successful sub-impulse under one shared move count, leaves blocked-all inputs
uncounted, and groups undo/redo by that count. `GameController` now calls this
coordinator.

Verification:

- The original `multi_order_0` fixture applies all four player-block moves with
  `moveCount === 1`.
- One undo restores all four player blocks and returns the count to zero; one
  redo reapplies all four moves with count one.
- A leftward input with every player block blocked produces no history entry and
  leaves the count at zero.
- Full suite: 2 test files, 8 tests passed.
- TypeScript build and production Vite build passed.

## Investigation: `infenter_zone_v2` step 41 divergence

### Observations

- Environment: Windows, TypeScript 7.0.2, Vitest 4.1.10, and the original
  Unity runtime observed through the BepInEx command probe.
- All 364 official levels match the original initial state exactly.
- The first 100 movement sweeps match at every step. In levels 101–200,
  `infenter_zone_v2` is the only mismatch.
- `infenter_zone_v2` matches through 40 commands. Command 41 is the fourth
  consecutive `DOWN`; original hash is `a1803ed6…`, Web hash is `8f08e4c4…`.
- No undo, redo, or restart occurs before the divergence.
- The level contains a detached infinite-enter reference targeting level 3,
  so the failing boundary is inside infinite-enter traversal rather than Hub
  progression or grouped box-push counting.

### Hypotheses

#### H1: Infinite-enter unwind selects the wrong generated entry wrapper (ROOT HYPOTHESIS)

- Supports: the first three downward moves agree and the fourth crosses a
  deeper repeated-entry boundary; this is exactly where `infEnterNum`
  increments after detecting a repeated enter.
- Conflicts: the earlier focused infinite-enter fixture passes, so the defect
  requires this level's detached/reference topology.
- Test: capture full original and Web block snapshots immediately after step
  41 and check whether the differing block is placed in the wrong generated
  infinite wrapper/level.

#### H2: Fraction-to-cell mapping rounds the fourth downward entry differently

- Supports: recursive entry projects a position fraction through every prior
  enter/exit and floors the final coordinate.
- Conflicts: vertical movement into this topology may not transform the
  horizontal fraction at all.
- Test: compare the moved block's destination coordinates while verifying
  whether the destination level identity is otherwise the same.

#### H3: A transient `justEnteredArray` or `justInfEntered` flag leaks between inputs

- Supports: the mismatch appears only after repeated same-direction inputs,
  and those flags suppress or annotate recursive-entry behavior.
- Conflicts: the engine clears both flags at the start of every queued box
  impulse, matching the original high-level input loop.
- Test: inspect whether the structural destination is correct but only a
  subsequent move/history effect differs; also replay step 41 from a freshly
  captured step-40 state.

#### H4: Generated infinite-zone object ordering differs only after runtime expansion

- Supports: initial allocation order matches all 364 levels, while step 41 can
  be the first point that creates another generated zone.
- Conflicts: the mismatch hash could occur without any new blocks.
- Test: compare block counts and the IDs/order of blocks appended at step 41.

### Experiments

#### E1: Compare exact step-41 structural snapshots

- Change: capture the original after exactly 41 commands, then temporarily
  bypass only that one hash assertion so Vitest prints the exact final
  structural diff. No gameplay code is changed.
- Prediction: H1 is confirmed if the player/moved block has a different outer
  generated wrapper; H2 is confirmed if only its coordinate differs; H4 is
  confirmed if the block arrays differ in length/order.
- Result: the block counts and ordering are identical, rejecting H4. Before
  step 41 the root stack is player `57` at `(5,3)`, reference `74` at `(5,2)`,
  and block `59` at `(5,1)`. Original block `74` eats block `59` into the
  existing infinite-enter level 7 at `(1,0)`, then the stack advances. Web
  fails that eat and instead lets player `57` enter reference `74`, landing in
  the same level 7 at `(1,2)`. H1 is narrowed to the failed infinite-eat
  branch; the pre-existing wrapper itself is mapped correctly.

#### E2: Log the Web infinite-eat target coordinate

- Change: one temporary diagnostic log after `computeEnterTargetPos`, limited
  to moved block 59 in `infenter_zone_v2`; revert it after the run.
- Prediction: H2 becomes the root cause if Web computes a different horizontal
  target (most likely 2 instead of original 1), causing the eat to collide.
- Result: **rejected**. Web computes `(1,0)`, exactly the original destination,
  for the infinite-eat attempt through block 71. It first tries blocks 74 and
  76 while unwinding, then reaches the correct pre-existing infinite-entry
  block 71.

#### E3: Observe why the correct `(1,0)` attempt returns false

- Change: one temporary log of the recursive result and cancellation/unwind
  flags immediately after `attemptToMoveToSpot` for block 59.
- Prediction: if the correct attempt returns true, the defect is later move
  resolution/backtracking; if it returns false, the flags identify which
  recursion guard rejects an otherwise vacant target.
- Result: the correct attempt never reaches `attemptToMoveToSpot`. After the
  unwind, there is deliberately no prior move for block 59. Original C# leaves
  the transient move's `fromLevel`/`fromLevelBlock` null and continues; Web has
  an extra `if (!lastMoveForBlock) return false`, so it rejects the valid
  infinite-eat before testing vacant `(1,0)`.

### Root Cause

The TypeScript port added a defensive early return that is absent from the
original: an infinite-enter retry with no remaining prior move must still be
allowed to carry null transient source references, because successful vacant
entry does not need those fields.

### Fix

Remove the early return and make only the transient attempt-move source fields
nullable, matching the original `Move` struct's default null references. Keep
normal history moves strongly non-null. Add the exact 41-command
`infenter_zone_v2` original-runtime trace as a permanent regression fixture.

Verification:

- The focused 41-command trace now matches at every step and in the final
  block-by-block snapshot.
- All 364 official levels matched their original initial structure.
- All 364 official levels then matched a 58-command sweep containing movement,
  continuous pushes, undo, redo, and restart; the temporary sweep fixtures
  were removed after the comparison.
- Permanent suite: 5 files, 42 tests passed. TypeScript checking and the
  production Vite build also passed.

## Extended deterministic fuzz conformance

### Method

- Added `-FuzzLength` and `-FuzzSeed` to
  `scripts/capture-original-conformance.ps1`.
- Each official level receives a different deterministic command stream
  derived from the base seed and its metadata order.
- Directional commands are emitted in bursts of one to eight repeated inputs,
  with undo, redo, and restart interspersed. Bursts reach recursive boundaries
  much more reliably than independent random directions.
- The original BepInEx probe and the TypeScript replay hash the same structural
  fields after every command.

### Result

- Base seed: `731`.
- Coverage: all 364 official levels.
- Commands per level: 160.
- Total compared commands: 58,240, in addition to every initial state.
- Result: **all per-step hashes matched**.
- `flip_clone_line` expanded a sufficiently large dynamic clone graph that the
  original probe needed about four minutes to finish its full capture batch.
  The game did not crash and the resulting trace matched the Web replay.
- The 8.7 MB temporary fuzz fixtures were removed after verification. Only the
  reusable generator and the minimal permanent regression fixtures remain.

## Hub progression matrix conformance

### Method

- Extended the original-runtime probe with an in-memory save override. It does
  not call `SaveFile.Save` and restores the real save object after each case.
- Captured 10 deterministic Hub states: empty saves, early Intro progress,
  three seeded partial-completion sets, Nexus-only, full completion with Nexus
  locked, and full completion with Nexus unlocked.
- Compared every portal's won/unlocked/hard state, every remaining unlock wall,
  active fast-travel stops, special/info floors, shortcut flags, recent area,
  and the player's Hub position.

### Result

- All 10 original snapshots match the TypeScript Hub model exactly.
- The comparison exposed three missing shortcut rules from the original:
  completing Priority, Extrude, and Push also completes the Appendix shortcut;
  full completion additionally marks Index and Reception.
- A separate source-level audit found the original ending guard in
  `World.UpdateButtonsPressed`: the Hub finish cannot activate until the `iii`
  portal is won. The Web model now enforces this with a regression test.

## Browser session and input flow

- Default startup now loads the Hub behind a title gate rather than jumping
  directly into `first_puzzle`; explicit `?level=` URLs remain available for
  deterministic debugging.
- Esc opens a functional pause state. A puzzle can return to its Hub portal,
  and the Hub can return to the title state.
- Browser key repeat is no longer accepted as independent movement events.
  A pure logical direction stack mirrors the original last-pressed-direction
  behavior, coalesces WASD/arrow bindings, and repeats held movement on the
  original default 70 ms delay.
- Runtime verification on `multi_order_0`: one initial keydown plus eight
  synthetic browser repeat events produced one move count and one ordered
  four-player-block action.

## Save files, playtime, and Hub information

- Implemented the original four-save-file flow, including switching slots,
  empty-slot handling, and the two-stage delete confirmation.
- Legacy single-save data migrates into slot 1. Slot summaries count only the
  364 official puzzles so stale development names cannot inflate completion.
- Playtime is stored per slot, advances only while the page is visible and
  focused, saves periodically and on page hide, and uses the original `HH:MM`
  display rule.
- All eight official Hub `Info` keys now resolve to the exact English strings
  used by the original localization file. Runtime verification confirmed that
  walking onto the Tips-area information floor opens the complete message.

## Multi-player camera focus and recursive box inspection

### Original behavior

- `LoadLevel` initially assigns the first top-level block to
  `Draw.MultiplePlayerFocusBlock`; special effect 12 overrides that marker.
- `Draw` uses that marker whenever more than one player block exists. This is
  one human controlling multiple in-world player blocks, not network or
  four-human multiplayer.
- `World.InspectUpdate` lets left click or scroll-up enter one direct child box
  with a non-filled sublevel. Right click, scroll-down, or clicking outside
  exits one level. Movement, undo, restart, loading, and pausing reset inspect.
- Each crossed flipped box toggles `InspectFlipH`.

### Web implementation and verification

- The parser preserves the original multi-player focus marker for both
  `Block` and `Ref` lines and updates it when an exit reference is replaced.
- `InspectionModel` owns the inspected block and flip parity independently of
  Pixi rendering. Hit testing accepts only direct child boxes, exactly like
  the original grid lookup.
- The renderer immediately displays the selected block's sublevel and mirrors
  grid coordinates when inspect flip parity is active. Camera tweening remains
  a later presentation task; selection and input semantics are complete.
- `multi_order_0` opens on its effect-12 9×9 focus containing all four player
  blocks. Browser verification confirmed right click/down-scroll exits to the
  5×5 wrapper, left click/up-scroll re-enters, and a blocked direction input
  still resets the inspect state.
- Regression suite after this work: 11 files and 84 tests. TypeScript checking,
  the production build, and browser console-error inspection all passed.

## Camera flip is gameplay state

- Original `Movement.PlayerMovementLogic` reverses horizontal input whenever
  `Draw.FlipH` is active. A turn records both `FromCameraFlipH` and
  `ToCameraFlipH`; crossing a flipped recursive boundary toggles the camera,
  while undo, redo, and restart restore the recorded value.
- The Web history now stores the same per-turn camera state. The controller
  converts screen-relative left/right input to world-relative movement before
  invoking the already-conformant movement engine.
- Rendering and inspect hit testing use camera flip XOR inspect flip, so the
  displayed grid, clickable cells, and controls agree.
- A permanent original-level regression uses
  `1by1_playerr_flip2` to reach the boundary, then verifies the flip transition
  and undo/redo restoration. Browser runtime verification reached
  `camera flip h`, and undo returned to the exact pre-crossing level and
  camera orientation.
- Regression suite after this work: 12 files and 86 tests. TypeScript checking,
  production build, and browser error inspection passed.

## Fixed-focus and draw-style control rules

- `static_focus_block` now preserves the first special-effect-1 block and uses
  it as the fixed camera focus, matching `Draw.CameraMode.SpecificBlock`.
  Recursive mouse inspection is disabled in that mode.
- Level headers now retain `draw_style tui`, `draw_style grid`, and
  `draw_style oldstyle`.
- Old-style levels focus the player block itself and derive horizontal input
  orientation from that player's `FlipH`. Grid and TUI modes do not apply the
  normal camera-based input reversal. Recursive inspection remains available
  only in normal draw style, as in `World.InspectUpdate`.
- Browser checks confirmed both `static_focus_block` and
  `oldstyle_lock_two_doors` ignore right-click inspection, while normal levels
  keep the new inspect controls.

## DemoEnd floor behavior

- The original `Floor.UpdateAnimation` advances `Info`/`DemoEnd` `AnimT` by
  `1.75 * dt` while a player occupies the floor, decays it when the player
  leaves, and writes `-0.4` while paused. The Web `WorldModel` now keeps the
  same non-undo presentation state.
- `test_demo_end` exposes the original three English messages through the
  localization table. The renderer fades them in over the original 0.65
  seconds and draws a dedicated DemoEnd floor marker.
- Escape on a DemoEnd floor is consumed as undo, matching `World.Update`
  instead of opening the pause menu. Other floors retain normal pause behavior.
- Pure regression coverage verifies animation ramp/decay, pause reset, text
  keys, Escape routing, and the smooth fade curve.
