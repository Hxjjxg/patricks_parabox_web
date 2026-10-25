# Gameplay Debug Journal

## 2026-10-25 rendering parity investigation

### Observations

- Starting revision f8e7539, clean worktree; baseline 20 test files / 155 tests pass. Third playable ID is third_puzzle (a3 and second_puzzle→third_puzzle portal link), root9×9, player(2,4), nested box(4,6).
- Untouched real-browser capture: docs/parity/evidence/web-third-before-800x600-dpr1.png, 800×600 CSS pixels and 800×600 backing canvas, DPR≈1 after reload, identity orientation, moveCount0, default70ms move delay, animation skipping false. Thin lines cross connected pale walls; lower/right light bevel is missing.
- Original live DLL Draw.SetDrawRect truncates both shared rectangle endpoints; DrawWall uses exact cell rectangles and selects mirrored WallTilesFlip for flipped rendering. Original bilinear wall imports clamp edges without mipmaps.
- Pixi textured Graphics.fill invokes generateTextureFillMatrix, which forces repeat addressing. Existing Web loadWall maps neutral193 and highlight255 both to255, clipping contrast. These mechanisms require paired original output before a fix is approved.
- Native sky capture returned 'Computer Use was not approved to use Patrick’s Parabox'. Original agent is testing supported non-UI BepInEx screenshot capture; no UI rejection bypass attempted. Chrome screenshot filePath also denied configured root; successful screenshot result was saved through filesystem tool instead.

### Hypotheses

- H1 (root seam hypothesis): fractional independent Graphics rectangles antialias at shared edges while original snaps shared endpoints. Supports original SetDrawRect and Web fractional geometry; conflicts: no controlled render experiment yet. Test adjacent-cell edge partition and real Canvas before/after endpoint snapping.
- H2: Graphics texture fill repeat addressing samples the opposite texture edge, creating apparent lines/bleeding. Supports Pixi 8.19 source; conflicts: fully connected wall texture is opaque. Test direct textured quad with clamp source on same geometry.
- H3 (root highlight hypothesis): normalizing neutral193 to255 also clips white highlights, erasing bright bevel. Supports pixel transfer math; conflicts: original tint shader transfer needs screenshot measurement. Test original neutral/highlight samples and Web texture transfer.
- H4: wrong autotile neighbor/index mapping creates incorrect bevel directions. Supports reported wall appearance; conflicts: original unflipped mapping agrees with Web; camera-flipped selection is missing. Test all masks and mirror involution against original mapping.

### Experiments / next step

Settled original reference obtained at docs/parity/evidence/original/third-baseline-settled-20261025. Three native static captures have identical pixels in the reviewer’s stable wall/floor ROIs. Original body=(216,215,216), white bevel=(255,255,255), dark bevel=(156,158,156). Original Draw.ProcessTicket computes brightness from CELL fraction .09111 at800×600, allowing gain above1 before texture multiplication.

- H3 confirmed: clipping texture normalization plus whole-board rather than cell brightness caused the missing white bevel. New raw-texture and unclamped-tint tests failed before correction.
- H1 confirmed for actual geometry: direct quads require shared grid endpoints. First corrected render exposed vertical black gaps at x317/x481 because independent floating-point expressions straddled truncation boundaries. Two exact-grid regressions failed; computing each endpoint from the common origin+index×step fixes the partition without epsilon, overlaps, or expansion.
- H2 is a source-confirmed sampler mismatch (Pixi fill forces repeat versus native clamp). Direct quads preserve clamp; its separate contribution to the baseline defect was not isolated from fractional antialiasing. Do not claim an independent pixel attribution.
- H4 rejected for normal masks; source-confirmed missing mirrored family/mask was corrected and separately regression tested. Live flipped output review remains part of the full matrix.

### Root cause and fix

Wall contrast was destroyed before tint multiplication and wall brightness used the wrong spatial scale; textured antialiased cell fills also lacked the original clamp/shared-pixel-edge contract. Raw textures, float HDR tint in a reused shader, direct clamp quads, shared grid boundaries and native endpoint truncation preserve those contracts.

11 wall regressions pass (initial5 demonstrated failures, then2 precise integer-boundary cancellation failures). Independent reviewer measured repaired800×600@1 actual output: four white bevel points match255 exactly; body and dark bevel differ by at most1 channel; old internal seam rows/columns are uniform. This supports the measured module, not universal parity. Full tests at this point166/21files, typecheck and production build pass.

### Further evidence / next experiments

#### Camera presentation phase investigation

- Independent phase-bracket comparison of actual Canvas PNGs shows rendered player bounds match the PREVIOUS Web model frame (16.6–16.7ms earlier), whereas numeric projection at equal native phase agrees within9e-8. At three saved phases bbox maxerror is2.71/4.29/8.56px at declared phase and1.53/1.62/1.54px at prior phase (remaining border differences are separately open). Evidence: review/camera-entry-presentation-lag.json and phase-bracket PNGs.
- H1: capture metadata only is incorrectly associated. Supports recorder samples after controller; conflicts renderer ticker registers its draw and render before controller RAF, which also affects actual presentation. Test stamp model phase when renderer builds the actual scene and compare that stamp to recorder/model and PNG phase.
- H2 (root candidate): independent ticker/controller RAF loops present a model state one frame late. Supports source registration order and actual PNG bounds at prior phase; conflicts: accepted input can synchronously rebuild graphics before next ticker. Same phase-stamp experiment distinguishes first-frame behavior and subsequent lag.
- H3: native intentionally renders prior phase too. Conflicts native end-of-frame metadata and actual images agree at current native phase; test original phase bracketing and accepted-event timestamps, already available.
- H4: long frames/PNG encoding alone explain differences. Supports variable capture intervals; conflicts exact prior-frame phase association across three independent phases. Test timestamped scene-build phase before any ordering change. No universal smoothing or curve changes are justified.

Experiment: one diagnostic line stamped the player phase when `draw()` built the scene. Before correction, all8frames built the previous phase (first model .0136, rendered0; nextmodel .0302, rendered .0136). After correction all8 scene phases equal their current model phases exactly, including landing. Diagnostic source was removed; raw observations are `frame-order-before.json` and `frame-order-after.json`. Initial experiment was inconclusive because HMR destroyed its context; the stable-page rerun supplied the evidence.

Root cause: Pixi started its independent ticker before the controller RAF, so both scene construction and GPU presentation preceded the model/camera update. Fix: initialize Pixi with autoStart=false and advance its ticker only after the controller finishes updating the same RAF timestamp. No curve, skip rule, queue decision or post-press delta clamp changes. Seven controller integration regressions cover8/16.7/25/50/100ms frames, one queued turn, and the between-frame stale-moving window; they fail before and pass after.

Independent review replays native entry itself and compares actual synchronized Web PNGs by phase: corrected images match current phase (diagnostic bbox residual1.00/1.17/1.04px) rather than previous phase (1.69/2.68/8.50px). Numeric projections agree within1.1e-7. Remaining≈1px border geometry is a separately confirmed open defect, not scheduling tolerance expansion. Full integrated checks:303tests/25files, typecheck and build pass.

- Native first/right and third/up NORMAL and BUMP_HALT samples are preserved in tests/fixtures/original-animation; the phase-aligned test uses native times and1e-6 floating tolerance, not screenshot frame numbers. Native conformance fixture infenter_zone_v2-generated-zone-dddu exercises DOWN DOWN DOWN UP and proves wentToInfZone=true.
- Confirmed floor shading discrepancy: original black gradient alpha .08 goes directly to the default doubled-alpha GUI shader, so effective opacity .16; Web .08 gives gray89 where native83. This is a separate focused fix after wall module verification.
- Large-wall≥256px quadrants, outer borders, timed queue/camera transitions and remaining matrix cases still need verification/correction. Original camera setup v1 captures that were not fully settled are diagnostics, not parity passes.

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

## Mobile swipe input

- `TouchSwipeInput` mirrors the original mobile gesture threshold:
  `min(viewportWidth, viewportHeight) / 15`.
- A touch emits one dominant-axis cardinal impulse when it crosses the
  threshold, then re-arms from the current point for the next swipe.
- A short touch remains a tap, so recursive inspection can still open a
  direct child box on pointer release; swipes reset inspection through the
  normal movement path.
- Pointer cancellation and level loads clear the active gesture. Multiple
  simultaneous touch points are ignored while the first gesture is active.

## Touch repeat investigation

### Observations

- A synthetic touch swipe on `multi_order_0` crossed the threshold and moved
  once, but holding the pointer for another 160 ms did not visibly move again.
- The same level can be blocked on the next cell, so that case alone cannot
  distinguish a missing repeat from a legitimate blocked impulse.
- A short touch at a recursive child opens inspection and leaves `moveCount` at
  zero.

### Hypotheses

#### H1: Touch direction is not retained in the input stack (ROOT HYPOTHESIS)

- Supports: the first implementation called `impulse` only from
  `pointermove`; no state fed the frame repeat path.
- Conflicts: none after isolating an open movement path.
- Test: hold an upward swipe in `first_puzzle`, where consecutive cells are
  open, and compare the move count after 200 ms.

#### H2: The second impulse is blocked by the level geometry

- Supports: `multi_order_0` blocks some directions immediately after its
  starting row.
- Conflicts: does not explain an open vertical path in `first_puzzle`.
- Test: repeat the same gesture on the open vertical path.

#### H3: Synthetic pointer events are not reaching the new listeners

- Supports: browser emulation can preserve an older hot-reloaded handler.
- Conflicts: the first swipe already changed the player position, proving the
  pointer lifecycle is active.
- Test: reload the level, dispatch a touch sequence, and inspect `moveCount`.

### Experiments

- On `multi_order_0`, the first swipe moved once; this was inconclusive because
  the next target can be blocked.
- On `first_puzzle`, a held upward swipe on an open path produced three moves
  over 240 ms after the repeat path was connected; a short touch still produced
  no movement and retained inspection behavior.
- The mobile viewport case (`390x844`) produced one ordered move from a single
  swipe, confirming the threshold scales with the viewport.

### Root Cause

The initial touch bridge emitted a one-shot impulse and never retained the
active swipe direction for the existing movement-delay repeat loop.

### Fix

Touch swipes now use the shared `DirectionalInput` stack under a synthetic
`__touch__` key. Crossing the threshold emits immediately, the animation frame
loop repeats at the configured delay while the pointer remains down, and
pointer up/cancel releases the key. The pure `TouchSwipeInput` tests cover the
threshold, axis selection, pointer ownership, tap classification, and cleanup.

## Pause-menu Extras hierarchy

- The pure session menu now follows the original Extras order:
  `Custom levels`, `Tips`, `Credits`, `Links`, `Recurse`, `Back`.
- Links retain the original seven destinations and URLs. Opening one leaves
  the Links menu active, matching `Application.OpenURL` behavior.
- With no local custom-level directory, the web menu exposes the original
  website entry and keeps it as an explicit link action.
- `Recurse` adds a nested pause layer. Its `Back` item and Escape path both
  return to Extras with the selection on `Recurse`, while the outermost pause
  Escape still resumes the game.
- Regression tests cover link actions, custom-level website fallback, recurse
  depth, and every return path. External URL launching remains in the
  controller; filesystem custom-level loading is a separate module.

## Random orientation investigation

### Observations

- Scope: reproduce the original game's `Random orientation` behavior before implementing it in the Web port.
- Environment: Windows PowerShell, Node.js 24.11.1, npm 11.6.4, .NET SDK 10.0.203. The original executable and `Assembly-CSharp.dll` are dated 2022-03-30. The game was not running when observation began.
- Web baseline: commit `b38930a`; only the user-owned untracked `CLAUDE.md` was present. `ProgressionModel` persists the setting, but `parseLevel` receives no randomization option and `GameController` does not reload a non-Hub level when the setting changes.
- Both AssetRipper and dnSpy output show that `LoadLevel.SetRandomization` enables randomization only when `SaveFile.Current.Randomize && !World.InHub()`.
- The original samples horizontal mirroring and rotation until the result is not the identity transform. It samples rotation from 0/90/180/270 degrees unless any source `Block` token 14 or `Ref` token 13 has `flipH`; in that case it samples only 0/180 degrees.
- `LoadLevel.Transform` mirrors first, then transforms coordinates with the containing level's unchanged width and height. It is called for non-root `Block`, `Wall`, `Floor`, and resolved `Ref` records. It does not change a block's own `flipH` flag.
- The original packaged `7by3ref` text is byte-for-text identical to the Web copy. It has a 7x3 root level, includes no built-in `flipH`, and has child x coordinates up to 6. A 90- or 270-degree transform produces y coordinates up to 6 while the containing level height remains 3.
- dnSpy confirms the live `Block.Init` directly indexes `OuterLevel.blocks[x, y]`; it does not tolerate out-of-bounds coordinates.
- The original wraps level parsing in `LoadWithFailsafe`: any parsing exception is logged and sends the player to the Hub.
- Minimal reproduction: enable `SaveFile.Current.Randomize`, repeatedly load `7by3ref`, and record both the chosen private transform fields and whether the requested level reaches `World.WS.Playing`.

### Hypotheses

#### H1: The shipped game really fails 90/270-degree loads for non-square levels (ROOT HYPOTHESIS)

- Supports: the live DLL transforms coordinates into unchanged rectangular grids and `Block.Init` indexes those grids directly; `LoadWithFailsafe` explicitly catches load exceptions and returns to Hub.
- Conflicts: a user-facing post-game option would become intermittently disruptive on several official levels.
- Test: force the randomization setting in the observer and repeatedly load `7by3ref`; correlate odd rotations with a load exception or Hub fallback.

#### H2: The runtime DLL applies an additional rectangular-level restriction absent from the AssetRipper source

- Supports: a restriction to 0/180 degrees would make every transformed coordinate valid.
- Conflicts: dnSpy's live DLL output is identical in substance to AssetRipper's `SetRandomization` and has no dimension check.
- Test: log the live private `LoadLevel.transformRotation`; if repeated rectangular loads never select 1 or 3 while square loads do, a runtime restriction exists.

#### H3: A hidden built-in `flipH` record restricts `7by3ref` to 0/180 degrees

- Supports: `SetRandomization` explicitly restricts rotation when any `Block` or `Ref` has `flipH`.
- Conflicts: the original packaged text is identical to the Web copy and every relevant token is false.
- Test: observe whether odd rotations are selected at runtime.

#### H4: The runtime changes level dimensions or tolerates temporarily out-of-bounds rotated coordinates elsewhere

- Supports: successful odd-rotation loads would require behavior beyond the shown `Transform` method.
- Conflicts: the live parser initializes each `Level` with source width/height before transforming children, and live `Block.Init` immediately indexes the fixed grid.
- Test: when an odd rotation is observed, inspect the loaded root level width/height and transformed child positions; a successful load would confirm a hidden accommodation.

### Experiments

#### E1: Force randomization and correlate live transforms with rectangular loads

- Change: on the observer's isolated in-memory save, set `Randomize = true`; shorten only the diagnostic timeout to 180 frames; read the two private transform fields after each load. The experiment changed exactly five lines and no Web production code.
- Prediction: H1 is confirmed if an odd rotation is selected and the original throws an out-of-bounds load exception or falls back to Hub. H2/H3 are rejected if odd rotations are actually selected. H4 is rejected if those loads do not complete with adjusted dimensions.
- Result: **H1 confirmed; H2, H3, and H4 rejected.** Four independent odd-rotation samples were selected: `(flip=true, rotation=1)`, `(flip=true, rotation=3)`, `(flip=false, rotation=3)`, and another `(flip=false, rotation=3)`. Every sample immediately produced `System.IndexOutOfRangeException`. A subsequent `(flip=false, rotation=2)` sample loaded `7by3ref` successfully.
- Cleanup: the five diagnostic observer changes were reverted after recording the result, then the clean observer was rebuilt and redeployed.

### Root Cause

The shipped game applies 90/270-degree coordinate transforms to rectangular levels without swapping their dimensions, so random orientation genuinely has an original-game load-failsafe bug on affected layouts; the Web port must reproduce the transform selection and coordinate rules, including the resulting parse failure boundary, rather than inventing an unobserved rectangular restriction.

### Fix

Implemented the original transform in pure `core/orientation.ts` with injectable randomness. `levelParser` now selects one non-identity orientation per non-Hub load, applies it to source Block/Wall/Floor/Ref coordinates, preserves each block's own `flipH`, and restricts selection to 0/180 degrees when source flip flags require it. Official and custom loads use the slot setting; changing it reloads the current non-Hub level, while Hub remains untouched. Parse failures follow the original failsafe back to Hub.

Verification:

- Seven focused tests cover all eight coordinate transforms, all seven selectable non-identity orientations, identity retry, Block/Ref flip restrictions, every transformed record type, Hub/custom behavior, mirrored movement, and the observed `7by3ref` failure boundary.
- Full suite: 17 files and 122 tests passed. TypeScript checking and the production Vite build passed.
- Browser menu check on `carry_adjust`: after one move, enabling the option immediately reloaded at move count zero and moved the player from `(6,5)` to transformed `(2,5)`; disabling it restored `(6,5)`.
- Browser Hub check: toggling retained the same player and stayed in the Bonus menu, proving no reload.
- Browser failsafe check: deterministic 90-degree `7by3ref` loading logged `RangeError: Floor coordinate (0, 6) is outside level 0` and returned to Hub.
- Browser custom-level check: deterministic 90-degree loading placed its player at `(1,4)`; reloading with horizontal mirror placed it at `(4,1)` while retaining the same custom-level ID.
- Independent visual audit: 90 degrees and mirrored 270 degrees rendered correctly at desktop `1280x720 @1x` and mobile `390x844 @2x`; boards stayed square, entities/floors aligned to the grid, and recursive contents remained clipped inside their boxes without console errors.


## Queue phases / automatic win timing ? 2026-10-25

### Observations
Native stage hooks: UP accepted at73.793ms/frame301 increases count1?2; landing109.837ms/frame303 does not apply UP; next update126.501ms/frame304 applies UP and advances it by the full update delta. Release/LEFT do not replace UP. WinCount begins on landing and accumulates full landing delta, then loads at1.5s. Automatic load retains held direction/stack/repeat/blocked state. References: original-timing/DEBUG.md and evidence/original/queue-transition-phase-summary.json.

### Hypotheses
- H1 (queue root): processing queue after animation collapses distinct native phases, with counting delayed until actual impulse. Supported by source and same-update read-only hooks; no conflict. Test acceptance/landing/next-update controller assertions.
- H2: capture scheduling creates the apparent difference. Requested/delivered controls differ, but actual phase hooks correlate within the same native frame and reject this explanation.
- H3: differing animation curves produce the apparent queue delay. Measured NORMAL curves already conform; discrete model coordinates differ at update stages, rejecting a curve explanation.
- H4 (win root): impulse-started setTimeout and unconditional input reset cause early level load and lost held input. Both isolated native repeats disagree with those mechanisms. Test controlled controller frame timestamps.

### Experiments
On0481573 the native acceptance regression fails expected2/received1. With queue execution moved before animation and accepted count reserved, all20 focused controller/input tests and typecheck pass. Post-press delta and manual present ordering remain covered. Native source additionally confirms queued failure decrements the reserved count and successful history commit uses the reserved count. History edge cases remain under independent native investigation.

### Root Cause / Fix
Queue processing used current landing state instead of previous AnyBlockMoving, and count reflected execution rather than acceptance. Controller now reserves count, applies queued input before animation on the next eligible update, passes that count to history, rolls back failed queued actions, and resets repeat delay on actual impulse. Win timing correction remains in progress.


### Queue/history and win implementation results
- Seven native history runs additionally prove: successful pending move is flushed before Undo/Restart; blocked reservation is decremented before undo; acceptance preserves future; successful physical impulse clears future; successful redo cancels pending without flushing, failed redo preserves it. Controller regressions cover these boundaries with the same native routes.
- Win timeout removed. Win time accumulates only after animation recomputation reports settled/no queue, includes the full landing delta, and resets on pause. Automatic loads preserve direction stack, held state, last direction, repeat accumulation, and blocked-direction state; explicit debug loads retain their existing reset behavior.
- Actual browser artifact web-queue-native-phases-after: UP delivered66ms reserves count2 while still(3,2); landing101.2ms; queued action begins117.9ms on next frame with animT=.0167. This matches native phase order; requested timer duration is not treated as delivered time parity.
- Isolated browser web-win-held-after: landing101.2ms, second_puzzle load1600.7ms, held movement on next frame1617.4ms, no repress; landing-to-load1.4995s with16.6ms landing delta. Source/native count1.5 including full landing frame is satisfied. Detailed actual events in evidence/web-controller-native-phase-summary.json.
- Focused controller/input:27tests pass; typecheck and production build pass. Integrated run had319passing tests and8expected failing-before tutorial tests from the renderer agent's next in-progress module; no existing/controller regression failed. Full final integrated checks remain mandatory.


## Simultaneous physical keyboard sampling ? 2026-10-25
### Observations
Original Controls.Update reads all physical direction values once; PlayerMovementLogic updates logical stack in Up,Down,Left,Right order and accepts one command. Native first-simultaneous-up-right and first-simultaneous-up-down prove Right and Down selection, count1. Web processes each DOM keydown immediately; both same-frame orderings accept count2, first key physically moves and second queues. Four focused controller assertions fail before fix. Exact original delivered changes/updates are in evidence/original/input-boundary-replay.json.
### Hypotheses
- H1 (root): per-event impulses bypass native once-per-update control sampling. Supported by event handlers and actual native phase hooks, no conflict; two events before one frame reproduce wrong count2 versus1.
- H2: logical stack ordering alone is wrong. Reversing event order changes first movement but still count2; native always Right/Down for newly simultaneous controls, so sorting alone cannot fix multiple acceptance.
- H3: preexisting pending turn from setup explains count2. Fresh first_puzzle starts count0/no animation; four independent fresh harnesses reject this explanation.
### Experiment
Add only native expected simultaneous count/position assertions to fresh controller harness, both DOM event orders, then run selected tests:4/4 fail. No production diagnostic mutation; native source and read-only runtime hooks independently identify the same root cause.
### Root Cause / Planned Fix
Keyboard handlers execute model movement before the next input sampling/update. Collect physical keyboard state, reconcile new logical directions once per controller frame in native order, then apply at that same frame before animation and rendering. Retain actual press timestamps so the initial animation still advances only by post-press time. Regressions for prior post-press/queue invariants will use keys present at a sampled update; subframe press-and-release absent from every sampled update follows original Controls.ReadValue behavior. This introduces no extra rendered-frame delay.


### Simultaneous sampling results
Physical keyboard/swipe directions are reconciled once per controller update in native U/D/L/R order. Press timestamps retain post-press animation clamping; sampled movement is presented in the same controller frame. Native frames containing undo/redo skip logical direction stack updates. Prior queue/history regressions retain their original position/count/animation assertions with keys explicitly delivered across sampled updates. Four simultaneous assertions fail before and pass after. Eight direct original replay cases now match all301 update endpoints (count, coordinates, moving state, animation kind/time/length with1e-6 float precision), including overlapping key release revealing the older held direction.

## Held history cooldown investigation ? 2026-10-25
### Observations and hypotheses
- Native UndoInput.Update uses absolute Time.time, strict greater-than eligibility, float32 spacing .15 decreasing .005 before scheduling (first .145000011, floor .04). Empty-history attempts still accelerate. Undo has precedence, direction switches wait for the current cooldown; release resets next time and spacing but retains direction.
- H1 (root): DOM keydown/OS-repeat handling bypasses native cooldown/acceleration. Source and581 independently observed updates support it. A new delivered controller replay fails atframe44431: Web redoes immediately tocount6 while native remainscount5 under cooldown.
- H2: undo history itself is corrupt. Debug history conformance and prior committed queue tests pass; discrepancy occurs exactly on an ineligible redo key edge, rejecting this cause.
- H3: animation clamping delays state changes. Core coordinates/count diverge before animation and source eligibility explains the exact frame, rejecting a curve explanation.
### Fix and results
Pure core/historyInput.ts mirrors native float32 scheduler. Held undo/redo and pressed-edge restart are processed after queued impulses and before animation. Restart stays independent after UndoInput; failed history attempts also clear the blocked-direction flag. Four scheduler replays match all581 measured spacing/next-time/direction states exactly after native float32 conversion. Combined controller replays now match882 native update endpoints across12 scenarios at1e-6 animation precision. Focused combined37tests pass. Actual Canvas301-update diagnostic replays saved underweb-native-input-replay-v1, with external native-delta clock and unchanged production update/draw logic; natural frame pacing is a separate verification surface. Final integrated recapture remains required after rendering fixes.

## Native-clock actual Canvas held history — 2026-10-25
Observation: controller21af3e2 now replays all4 held-history native scenarios in actual Pixi Canvas:581 updates/180PNG files. Reviewer independently verifies raw-source hashes/masks/state and all36 count changes; maximumphase/transform residual8.536e-8 under unchanged1e-6.171 available mapped PNG pairs have exact player body bounds;5critical actual pairs were viewed. Missing native final screenshot45009 remains visually unverified.
Conclusion: bounded support for acceleration/switch cooldown/Undo+Redo priority/restart interruption under supplied native clock; this does not establish natural frame pacing or eye/particle parity.
Natural-rAF v2 follow-up:199frames acrossqueue/rapid/alternating/blocked paths; all four physical/count paths agree with native. Actualviewport1280x720 differs from800x600 native, so no cross-viewport pixel approval. Retain diagnostic artifacts and recapture matched viewport.
Static follow-up:20actualconditions captured (first3levels×3sizes×DPR1/2 plus third1280x900@1/2), sourceTS SHA256 recorded before subsequent face/glyph edits. Both canvasbacking and freshcount0 verified for all20. Independent static review pending; no universal pixel-parity claim.

## Expanded native mechanic phase conformance — observation/hypotheses
Observation: adding306measuredphase assertions across10nativecaptures produces96failures, concentrated in shed/exit/infinity; carry/cycle/possess/eat/push/entry/flip procedural cases otherwise pass. Failureexamples: shedcamera newX Web+.285714/native-.285714; exitnewX Web0/native-.222222; infinitynewY Web.428571/native0. ShedlateBUMP_HALT additionally WebXoffset0/native.002047369.
H1 (rootcandidate forcamera): unitsetup never performs renderer rebasing ofworld.usedX/Y/XS/YS. Renderer writesidentity aftersettled draws; purecore setup leaves accumulated oldtargets. Test: provide settled identityusedcontext aftereachsetup and re-run, withoutchangingproduction.
H2: a genuinecamera setCameraOffset composition/sign bug. Supports differentnewtargets; conflicts knownbrowser matchedtargetmetadata and reviewerproceduralphasechecks. Test: compare realCanvas capture targets againstnative andtestH1 before anyproductionfix.
H3: direct jumpingtoBUMP phase omits preceding ENTER_EXIT updates/context, or animationmathchooseswronghaltaxis. Supports onlyshedlatebumpoffsetmismatch; test realstep-throughallworldanimationtheninspectoffsetstart/parentflip againstnative, withseparate evidence before attributing defect.
Experiment result: providing the same settledidentityusedcamera context that nativeDraw/productionGameRenderer writes eliminates89cameraassertionfailures (no productioncamerachange). Remaining7shedBUMP_HALT samples stillfail. OriginalBlock.UpdateAnimation decompilation confirms strictAbs(X)>Abs(Y), so changingcomparison/toepsilon wouldbeincorrect. OriginalProjection.ComputeProjection usesfloatxscale/yscale dividedbyfromLevel dimensions beforeoffsetarithmetic.
Diagnosticexperiment (2lines): froundonlynativeexit-scaleassignments. All306measuredphaseassertionsnowpass. Shedinitialstarts change fromX=-.3333333333333333,Y=-.33333333333333337 (incorrectYaxis) toX=-.3333333432674408,Y=-.3333333283662796 (nativeXaxis). Native7latehaltoffset/scale samplesnowmatchunderunchanged1e-6.
Rootcause: JavaScriptdoubledivision reverses a near-tiedshedexitprojection magnitude comparison relative to nativefloat fields. Fix: retainnativefloat32assignment semantics for the two exit-scaledivisions, preserving strictcomparison andalltiming. No tolerancesinflated, noaxisheuristic/epsilon introduced. Productionchange2lines pluscomment; regressions306recordedmechanicphasechecksacross10captures. ActualmatchedshedCanvasreviewandfullsuitepending.

## Native quadratic easing and capture guard — 2026-10-25
Observation: exported core quadInOut(0.75)=0.625 and(1)=0.5; Util.cs16–23 source instead evaluates(k-=1) before(k-2), yielding0.875 and1. Hypotheses: incorrect mutation translation(root, directly confirmed source); intentional alternate easing(conflicts native source and endpoints); runtime precision(cannot explain0.5 error). Minimal numerical experiment evaluates both branches at0.75/1 and confirms translation defect. No callers/imports of this exported core helper currently exist; renderer shine uses its own correct native-float helper. Fix only second multiplicand to(j-3), with source-grounded phase/endpoint/symmetry tests; no camera curve change.
Capture experiment: invalid level id infinity silently fell back to first_puzzle; retained as diagnostic in web-production-candidate-v2/infinity. Correct id is infenter_zone_v2. Added immediate loaded-level assertion so future evidence cannot silently credit the wrong scene.

## Native goal geometry and backing transfer — 2026-10-25
Goal observation: native shed goal pixel145/162/189, Web191/192/192. Source draws four FullWhite strips(.0664inset,.0725thickness), not grayButtonTex; canonical HSVs*.75/v1/alpha.6 plus player-only eyes. Competing texture sampling and palette hypotheses are rejected by native drawFloor path. Actual drawFloor regression failed before the source-backed helper port. ce2826c adds exact strips, goal pulse, QuickAnim assets, goal AnimT lifecycle including pause,13focused checks; final PNG review pending.
Backing observation: native third-ticket center(400,300)=94 vsoldWeb95, exact native center-gradient alpha0. H1(root) backing skipped HSVToRGBGUI half-RGB transfer, directly predicted rawGUI.185779378→byte47×2=94. H2stalegradientextent cannot explain alpha0center; H3particles/gradient cannot explain repeatedflatcenter. Actual drawLevel regression failed0x5f5f5f vs0x5e5e5e, then passed changing only RGBconversion to measuredguiHsvColor.59e4a70; no offsets or tolerances. Final off-center residual/color-recursion PNG recheck pending. Full suite46files803tests/typecheck pass after combinedmodules and mainhelper/easing tests.

## Clean production follow-up / capture confounds — 2026-10-25
The immutable51-file v2dist snapshot now has16fresh-controller cases,256actualPNGs/713rAFstates with exact800x600backing. Native reportedDPR is browser1.0000000298023224; physical ratios remainexact1. All traces/rawPNGs indexed bySHA256. Invalidinfinityid fallbackenteredIntroHubportal and contaminated originalv2tutorialcontext; retaineddiagnostic, cleanrecapturesconstructnewcontrollerperURL. Setupguardnowwaits allmovingblocks(includingBUMP_HALT) pluscamera, sincefixed800ms didnotsettle infexit underlongframes. No productionclockchange.
Actualindependentreviewrestoresinfinityglyph/gold andflipboardtopology butconfirmsmissinggrayenclosure, earlyflipmirror/fade, andpossessdonoreyesnottransferring. Grayroot is missingnativeearlyopen-edgewhite.4pass;82bea3b addsitwithfailing-beforeactualdrawLevelregressions. Camera/cloneandpossessremainingrootsunderinvestigation. Allcapturedversionspredategoal/backing/grayfixes; nofinalintegratedapproval.
Perfexperiments: methodinstrumentation234draws/116frames showsCPUmedian2ms/max6.2 vsrenderFramemax243.4. NoPNGimmutableproductionRRD77framesmedian16.7/max183.3,four>50ms. PNGcapture5frames300–883ms isheavilyreadbackperturbed; rejecteduniversal5FPSclaim. Shaderwarmup/GPUmaskcost/sourceclampcullingremainseparatehypotheses; noarbitrarydepth/smoothingpatch.

## Native GUI font placement experiments — 2026-10-25
RasterizationrootCanvasJostdiffersfromnative; v3atlas285ASCIIglyphs losslesslyrepacked andallalphas/advances/bearingsindependentlyverified. NativeFontEngineassetascentalonecannotexplainGUIbaselines. v6actualTextGeneratorquad+cursor deriveshinted13/17/21 withoutfits. Hypotheses: H1stagedGUIsnap(rootverticalsupported36independentlabels+3viewportanchors),H2simplecursorfloor(falsifiedv8fractionalorigin),H3perviewportoffset(rejectednon-sourceheuristic). Verticalstagedsnap nowregressed; horizontaladvancewidthstagedsnap passesnewlineMovebutFAILS6singleUndo probes(v9), retainedasfalsifications. Newwidth102signed-originMovev10passes18cases, rejectwidth/origin-onlyexplanation. Textstructure/inkbounds/preferredwidthstillopen, no1pxcorrectionintroduced. Native1001fourwhiteextrasexactlymatchalphaovergray60voidparticle; noatlasfilterchange.


## Alternate style core investigation ? 2026-10-25
Observation: independent actual PNG/state review confirms QUICK uses SQUISH_IN_PLACE .6/AnyMoving false, but Web uses NORMAL .1/AnyMoving true; TUI native BUMP_HALT length0 but Web .22. Native source Projection.GetEnterLength/GetBumpLength, UndoManager.DoRedo/StopAnimations and Draw.QuickAnimCamOff/Update identify distinct style branches.
Hypotheses: H1(root) omitted/misassigned style branches in core (supports exact source and measured kind/length/decay); H2 renderer-only defect (reject: pure animation kind and AnyMoving differ before draw); H3 differing settings/capture clock (reject: metadata delay70/skippingfalse/instantZoomfalse and fresh native scene show same rules).
Experiment: add regressions from preserved raw native captures and exact source rules before production edits. Match measured phase transforms with unchanged 1e-6 float precision. Camera tests must include previous used-context composition and gradual newCamT delta/3; no ordinary interpolation substitution.

Result: all6initialstyle regressions failbefore; source-backed port nowpasses9stylechecks including32nativephase samples, camera composition/flip/longframe/fixedgate and negative repeatcounter. Native TUI zero-length intermediate NaN tokens are preserved raw and encodednullonlyinportabletestfixtures. QUICK StopAnimations intentionally retains squish. Fullsuite52files/839tests pass; typecheckpass. Renderer QUICKroot/rebasing and actualfinalstylePNG approval remainOPEN.


## Native Move atlas GPU sampling ? 2026-10-25
Observation: firstactual800x600Canvas atlas integration gives3whitepixels and scatteredatlasfragments, whereas native glyphmask has39; baselines/quads pass54placementfixtures. H1(rootcandidate): Graphics localtexturefill mapsfullsource0..1instead ofsubtextureUVframe; installedgenerateTextureFillMatrix confirms localbounds normalizationwithoutframe. H2wrongatlasbytes rejectedlossless285glyphtests; H3bilinear/fractionalplacement cannotexplainunrelatedatlasfragments andintegerquads. Minimaldiagnostic: useSprite(textureframe) foronecaptionglyph; ifproperMshape returns theUVpath is confirmed. Do not alterglyphbytes, inflatebounds, orfitpixeloffsets.

GPU experiment result: Graphics-subtexture actual800PNG3whitepixels -> Sprite-frame39whitepixels matching nativeMove. Root cause confirmed: local Graphics fills ignore frameUV. Diagnostic sprites replaced with a stable4glyph pool; renderer regression verifies global integer coordinates, frame dimensions and instance count. Native66vertical/54Movehorizontal cases pass;12Undo horizontal falsifications remain unsupported. Actual3viewport dev PNGs retained; native1001fourwhite threshold extras are alpha-over-gray60 particles, Web1280three extras alpha-over-gray75 particles. No glyph/filter/offset adjustment. Final immutable whole-revision review remains required.

## Odd CSS axes at DPR2 — 2026-10-25
Observation: v4 static20cases match2780wall/426floor interior samples within unchanged1 and all2432join measurements, but90DPR2border supports differ from native1x. Three actual1600x1200 native scenes prove23of those differences are correct physical-pixel quantization, not AA. Seven larger requested native framebuffers clamp to1400height and remain unsupported; no resampling or substitute pass.
Hypotheses: H1(root for odd axes) nativeFocusRect truncates CSS center before multiplying DPR, losing1physicalpixel at odd CSS width/height; source predicts[1000,698] versus[1001,699] at1001x699@2. H2 wrong border thickness is rejected by equal-width translated support intervals. H3 antialiasing/particles is rejected by full-color hard edges stable across all3native/2Web repeats. Actual native2002x1398 additional probe has focusGeometry[1001,699,1146.3599900007248,1146.3599900007248]; actual frozenWeb all12root/player/gold sides are exactly[-1,-1] translated.
Experiment/conclusion: failing-before actual-reference helper regression gets[1000,698] not[1001,699]. Quantize only shared camera center in physical pixels, then divide by resolution; preserve native float constant/base and all1x/even2x behavior. Actual devafter all12sides match exactly, unchanged native references/precision. 57files/882tests+typecheck pass; renderer agent independently viewed raw paired crops. Final integrated candidate review and7unsupported original matrix cases remain open.

## Transition capture setup correction — 2026-10-25
Main mistakenly used full native solver routes as settled Web setup, so second startedcount23/winningtrue rather than22/false and third32/true rather than31/false. These3raw captures are preserved with validity.json marking them diagnostic-invalid-native-start, not passes. Authoritative native driver takes route.Substring(0,Length-1). Add expectedStarting guard to diagnostic harness, recapture correct prefixes with isolated empty saves and counts/coordinates/winning asserted before recording. No production timing change.

## Valid pointer inspection zoom — 2026-10-25
### Observations
Native source-gated enter pointer capture at340,250 selects nonfilled block81 and animates push/pop with length.5. Native quarter-phase selections retain newX/newY=-1/-1 and float32 scale1/9 during push; pop is1/9,1/9,9,9. Actual immutable Web v3 changes view0→81→0 but all camera fields stay identity. The older third_puzzle INSPECT_56 fixture bypassed eligibility; actual filled56 click rejects in both versions and must remain rejected.
### Hypotheses
- H1(root): logical inspection never calls the existing camera-offset composition. Supports InspectionModel push/pop and renderer setInspection assigning only view state, plus actual identity camera trace; no conflicting evidence. Test four native camera/gate regressions before production patch.
- H2: click maps to the wrong box. Conflicts: actual Web view81 and native candidate81 match at340,250. Rejected by existing raw traces, no coordinate mutation required.
- H3: animation exists but capture misses it. Conflicts:94actual rAF states all retain length0/phase1, versus source and native .5. Rejected by direct state trace.
### Additional source gates
World.InspectUpdate rejects global cameraMoving/AnyBlockMoving; child eligibility rejects Moving. Controls.Update sets InspectMouseIdle=false on mouse position change or either button held, so ordinary actual desktop clicks clear the idle gate. Preserve direct-child/filled rules.
### Experiment
Add native enter push/pop/reset and moving-child assertions only; run inspection tests before modifying production. Expected H1 failure is identity camera despite selected child.
Result: all4 core regressions fail exactly as predicted; both controller motion-gate regressions independently fail by selecting81 while the gate is true. No production diagnostic changes were used.
### Root cause / fix
InspectionModel changed only logical focus and omitted World.DoInspectZoomIn/Out/ResetInspect camera calls. Port source float32 argument construction into existing setCameraOffset/resetCameraOffset helpers, retaining shared native camera interpolation and speed preference. Add controller cameraMoving/AnyBlockMoving and child Moving rejection. No easing, geometry offsets, or filled eligibility change.
### Bounded verification
All6 initial core/controller regressions fail before and pass after;6 additional preference/long-frame/flip/zoom/reset-isolation cases also pass. Actual natural Canvas dev96rAF/23PNGs matches camera push(-1,-1,float1/9,float1/9) and pop(float1/9,float1/9,9,9), both.5seconds, with intermediate phases. Independent image review and immutable integrated v4 remain pending.
### Ancestor rendering follow-up
Actual paired midpoint reveals a second root: native phase.484shows enclosing gray board/walls around81; Web phase.533shows81alone over void. H1(root): GameRenderer explicitly skips its entire ancestor walk whenever inspectionBlock is set; native DrawBlocks2078–2148 walks numLevelsUp regardless of inspection. H2 phase mismatch cannot explain all omitted enclosing geometry and is rejected by native source. H3 min-draw-size culling cannot explain screen-sized gray walls and is rejected by root ticket not being submitted. Experiment: change only inspection ancestor-walk condition, capture same pointer path, restore diagnostic, compare actual surrounding board. Preserve native3-level walk/depth policy.
Result: first attempted HMR capture raced reload and returned no ready API; diagnostic was restored without capture credit. Second settled single-line experiment produced95rAF/12actualPNGs and restores enclosing gray board/walls at midpoint. Diagnostic then restored. Failing-before draw regression emits81/depth0 versus native0/depth-1; production removes only the inspection exclusion from the existing3-level walk. Timing-only dev-v1 remains a documented intermediate incomplete rendering result.

## Native recursive draw size gate — 2026-10-25
Renderer-owned investigation in docs/parity/renderer-draw-policy-findings.md records3hypotheses and source policy. Settled infinity DD had4095level4draws/6170layers; closing old tabs still7rAF/1990ms. Exact native5.4px one-variable gate experiment gives90rAF/1520.7ms and410layers, rejecting multi-tab/clip-only root. Production source prequeue gates preserve backing/depth15 and separate particle thresholds. Actual updated dev91rAF/1505.7ms,median16.7/max17.4;63level4copies/221layers,CPU2.4–2.7ms.73totallevels includesadditional nonrecursivelevel9 compared with settled harness72/218layers; do not conflate contexts. Actual before/experiment/after JSON and PNG retained under v3/performance, explicitly dev evidence after v3 manifest.
