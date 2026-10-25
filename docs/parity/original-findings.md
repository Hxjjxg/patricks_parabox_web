# Original behavior evidence

Baseline Web revision: f8e7539. Investigation date: 2026-10-25.

## First three playable levels

The original level IDs are first_puzzle, second_puzzle, third_puzzle. The
metadata labels are a1, a2, a3 (src/assets/data/puzzle_data.txt lines 95,
294, 329). The original progression links first_puzzle -> second_puzzle
(puzzle_lines.txt:67), second_puzzle -> third_puzzle (:240), then third_puzzle
-> enter (:270). Hub portal locations are hub.txt:1471-1475.

third_puzzle initial state has a 9 by 9 root, player at (2,4), and an orange
5 by 5 box at (4,6). Its source file has no randomization header. Matching
captures must use Random orientation disabled and an untouched initial state.

## Wall source evidence

Read-only dnSpy MCP calls against loaded Assembly-CSharp on 2026-10-25
retrieved Draw.DrawWall, Draw.SetDrawRect, and Autotile.AutotileWall. The
relevant code agrees with the AssetRipper export under
F:/AssetRipper_win_x64/parabox/ExportedProject/Assets/Scripts/Assembly-CSharp.

- Draw.SetDrawRect truncates x and y toward zero and computes width as
  trunc(x + width) - trunc(x), height analogously. Source Draw.cs:1308.
  Adjacent grid rectangles therefore share precisely the same integer edge.
  Independently rounding a width or expanding tiles is not this rule.
- Draw.DrawWall uses the exact w by h rectangle centered on the wall. It
  selects WallTiles[WallTileIndex] normally and
  WallTilesFlip[WallTileIndexFlipH] for horizontally flipped rendering.
  Source Draw.cs:2993.
- When both dimensions are below 256, the ordinary wall tile is used;
  otherwise the original uses four WallBig / WallBigFlip quadrant textures.
  Flat walls and QuickAnim bypass that branch. This larger-scale path needs
  separate verification rather than assuming one 128px texture is universal.
- Autotile treats up as y+1, down as y-1, and out-of-bounds cells as solid.
  A diagonal is solid only when its two neighboring cardinal cells are solid.
  Normal mask bits TL,U,TR,L,R,BL,D,BR are 1,2,4,8,16,32,64,128.
  The horizontal-flip mask exchanges L/R and corresponding diagonals.
- Exported wall texture importer metadata has filterMode=1 (bilinear),
  wrapU/V/W=1 (clamp), and enableMipMap=0. Metadata belongs to reconstructed
  assets, so live screenshot comparison remains required for final judgment.

## Input and timing source evidence

Original Movement.cs:1453 PlayerMovementLogic owns the logical direction
stack and movement gating. moveDelayCounter only increases while
World.AnyBlockMoving is false (:1543); readiness is a strict greater-than
comparison with MoveDelay milliseconds (:1547). Impulse resets the counter
to zero (:127); QuickAnim resets it to -0.1 (:130). A blocked single-player
impulse sets WaitForMoveDirChange (:228).

Existing AgentObserver RunScenario forcibly calls StopAnimations after each
command, sets AnyBlockMoving=false, and resets the multi-player queue. Its
fixtures prove terminal structural state, not interpolation, input acceptance
timing, visual clipping, or frame continuity. Those require timed captures.

At investigation start, LogOutput.log contains one prior hold scenario with
MoveDelay=70: successful position changes at t=16,199,382 ms; after changing
direction at t=1181, later changes at 1364 and 1464 ms. These are historical
logs with unrecorded frame intervals and capture settings, so they are only
leads and are not a new timing pass.

## Runtime captures and reproduction

The complete machine-readable reproduction catalog is
docs/parity/evidence/original/manifest.json. It records exact setup moves,
timed controls and durations, physical render dimensions, settings, and
valid/diagnostic/failed status for every retained original capture directory.
Each motion directory also contains start-state.json, end-state.json, actual
frame timestamps/deltas and animation/camera fields in capture.json, and PNGs
from the original framebuffer. Historical raw capture metadata is preserved;
the sidecar manifest supplies its originally requested setup sequence.

CUA rejected access to the original game. The approved alternative captures
use BepInEx/Unity ScreenCapture, not another native UI helper. A hidden launch
returned black frames; third-baseline-20261025 is retained as failed evidence.
A visible launch repaints normally; startup-faded images are not baselines.
third-baseline-settled-20261025 is the valid initial third-level reference.

First/second/third original static views were captured at 800x600, 1001x733,
and 1280x720. These are physical Unity dimensions, not browser DPR values.
The odd-size and widescreen v2 IDs include their dimensions in their name.
The original game was restored to 800x600 afterward.

Exact representative camera capture commands:

- enter-camera-entry-v2: setup UP RIGHT UP UP LEFT UP RIGHT RIGHT RIGHT RIGHT;
  then RIGHT:40 NONE:620. Starts move count10, outer0, player(5,5), enters
  outer3 at(0,2), animation length0.5s, target camera scale1/9.
- enter-camera-exit-v2: same setup plus one RIGHT; then LEFT:40 NONE:620.
  Starts outer3 at(0,2), exits outer0 at(5,5), length0.5s, scale9.
- carry-nesting-entry: setup LEFT LEFT LEFT; then LEFT:40 NONE:620.
- flip-short-crossing: level1by1_playerr_flip2, setup RIGHT RIGHT; then
  DOWN:40 NONE:620. Actual original cameraFlipH changes false to true.
- infenter-zone-dddu-motion-v2: setup DOWN DOWN DOWN in infenter_zone_v2;
  then UP:40 NONE:620. Original enters a generated zone; terminal structural
  fixture infenter_zone_v2-generated-zone-dddu.json proves WentToInfZone=true
  with four moves and per-action hashes.

All capture IDs in this list end with -20261025. Before the timeline, setup
commands alone may stop animation. Active timed animations are never stopped.
The v1 exit/infinity starts were found to have partly settled cameras; those
records are diagnostic and are superseded by v2. V2 waits at least0.8 real
seconds and newCamT completion.

## Measured observations and limits

At fixed third-level pixels (500,100), (435,200), (200,300), the settled
original RGB values are respectively (216,215,216), (255,255,255), and
(156,158,156). Three consecutive captures agree exactly at these samples.
The fixed body/shadow samples preserve compressed-texture channel variation.
This local zero variability does not define a universal screenshot tolerance;
particles and moving elements are excluded.

Draw.ProcessTicket computes wall fraction-of-screen from CELL dimensions,
not the entire board (Draw.cs near5782). ComputeWallColor retains brightness
above1, while HSVToRGBGUI halves RGB/alpha; Graphics.DrawTexture default
material doubles that modulation again. Normalizing neutral193 to255 and
clipping before tint destroys the distinct white bevel. For third-level cells
the original brightness multiplier is approximately1.11, making193 about215
and140 about156, while255 clips at final output.

The default gradient color is (0,0,0,0.08) (Draw.cs:316). With the same
Graphics.DrawTexture multiplier this represents effective alpha0.16.

Original timed input captures establish0.1s normal slides,0.22s landing
BUMP_HALT,0.125s undo/redo squish, and restart snap. The held-UP scenario
accepts moves at21,196,375ms then a blocked bump around541ms. Rapid direction
changes queue one direction while movement continues, apply it after landing,
and preserve the first accepted queued direction in these samples. See raw
phase data rather than interpreting a changed move count as immediate motion.

Motion capture temporarily requests60fps and disables vSync, restoring both
settings afterward. PNG capture lengthens some intervals (typically17-30ms;
some recursive frames longer). Recorded phase/time is authoritative.
motion-phase-index.json identifies nearest quarter/half/three-quarter frames
and exposes actual sampling error. Do not align unrelated frame numbers or
claim this proves native interactive frame pacing. Independent paired Web
capture review remains necessary for parity judgments.

## Additional captured behavior families

The expanded manifest includes actual possession (player index41 ->34),
eating (a box moves into the player sublevel), shedding (player exits while
its former containing box shifts backward), cyclic-level boundary entry,
second-level two-box pushing, and blocked release/re-press. Their native
start/end snapshots corroborate the action family; names alone are not used
as proof. Each has full phase screenshots and recorded frame deltas.

Two isolated first-level win captures use setup UP UP RIGHT RIGHT RIGHT DOWN
DOWN UP LEFT LEFT LEFT LEFT UP, then either UP:40 NONE:2300 or UP:2100
NONE:500. Despite their historical first-win-hub-* artifact names, the actual
native destination is second_puzzle, around1603-1606ms after final input.
When UP remains held, second_puzzle accepts it immediately after loading
(first observed movement about17ms later). These captures use a temporary
empty in-memory SaveData and a Harmony prefix suppressing SaveFile.Save.
isolation.json records3 suppressed save calls, equal persisted-save SHA256
before/after, and restoration of the previous in-memory save. No persistent
progress mutation is required to observe this transition.

Original Assembly-CSharp.dll SHA256:
CFCB386A623CF6C86C225163C0F90B0E1409357FCDB39222DD446ACECB7240BC.

## Confirmed compressed-texture decoder difference

A remaining1-2 output-byte wall color difference was traced to texture
decompression, using neutral original GPU readback rather than an arbitrary
palette adjustment. GPU_WALL:12 reads Draw.instance.WallTiles[12] and
WallTilesFlip[12] through Graphics.Blit into an ARGB32 Linear RenderTexture,
then ReadPixels into a linear RGBA32 Texture2D with GL.sRGBWrite disabled.
The original reports Gamma color space and Direct3D11; tile12 is200x200,
DXT1 / RGBA_DXT1_UNorm, bilinear, clamp, one mip. GPU readback retains
neutral(194,193,194), while AssetRipper and starting Web PNGs contain
(193,192,193) at the same29600 pixels. Shadow GPU(140,142,140) occupies
10000 pixels versus AssetRipper(140,141,140) at9600 and(140,142,140) at400.

The complete96 texture readback is gpu-walls-all-20261025. capture.json
records every texture source format and GPU format;
pixel-diff-and-hashes.json preserves both GPU PNG hashes and starting
AssetRipper/Web PNG hashes. All96 differ; the maximum opaque RGB-channel
difference is1 byte.730 alpha differences are also uniformly+1byte
interpolation rounding, not changed zero/opaque topology; details are in
alpha-diff-audit.json. Source assets were not changed by this investigator.

third-integer-1280x900-static-20261025 supplies a genuine integer-cell
native reference:738px board /9 =82px cells. Screen size was then restored
to800x600; the restored reference is recorded separately.

## Exact queue and transition update phases

The observer now emits phases.json with read-only hooks after actual control
delivery, around PlayerMovementLogic and queued impulses, around UpdateInner,
and around GoToLevel. Unlike capture.json.control (the coroutine's requested
control), controls-delivered identifies what the original update consumed.
Native timing is measured; screenshots do not establish uninstrumented pacing.

first-queue-phase-r40-u40-20261025 uses RIGHT:40 UP:40 NONE:300. At frame301
(73.793ms), actual UP is accepted into the queue: moveCount rises1→2 while
the player remains(3,2), NORMAL t=.0558008 and AnyBlockMoving=true. At frame303
(109.837ms), movement logic still sees moving=true; only update-after lands
in BUMP_HALT and recomputes moving=false. At frame304 (126.501ms), actual
controls are NONE, but the retained UP impulse runs, moves to(3,3), and its
animation advances by that frame's delta. Thus count changes at acceptance,
the landing update does not apply the queued step, and release does not cancel
an accepted step. first-queue-phase-competing-20261025 adds LEFT before landing:
the actual input is LEFT at the later impulse, but the preserved queue still
moves UP. Default AllowSkippingAnimation=false is recorded in both captures.

first-win-held-phase-a/b-20261025 repeat the isolated final-UP transition.
The winning impulse sets Winning immediately, but WinCount begins on the
update where the winning slide lands, adding that update's full delta. A:
winning impulse16.655ms; timer starts115.479ms; second_puzzle loads1605.526ms;
held UP moves(4,2)→(4,3) on the next update1622.185ms. B: impulse16.823ms;
timer starts101.307ms; load1591.133ms; next-update UP1627.468ms. The variation
is recorded frame-delta/capture cadence, not a changed duration rule.

GoToLevel preserves actual held controls, Movement.dirs=Up, dxLast=0,
dyLast=1, WaitForMoveDirChange=false, and moveDelayCounter≈1.49s exactly
across load. LoadLevel resets world queue/win/moveCount, not these Movement
fields. The held move is accepted on the very next update without release
or re-press. Both runs leave the disk save SHA256 unchanged, suppress3 saves,
and restore the previous in-memory save. Their full event summaries are in
queue-transition-phase-summary.json; investigation notes are in
docs/parity/original-timing/DEBUG.md.

## Queued action history semantics

Seven additional first-queue-* captures and history-phase-summary.json prove
the following at actual native method boundaries (not just end positions):

- Acceptance reserves World.MoveCount, but neither pushes past nor clears
  future. Only successful Impulse→TurnCompleted records the reserved count
  and clears future (Movement.cs:199; UndoManager.cs:597–603). A blocked
  queued impulse pushes no history and DoNextMultiPlayerImpulse decrements
  the reserved count (World.cs:1600–1616).
- Undo with nonempty past first flushes the queue, then undoes the latest
  count-group. A successful queued UP is committed then undone, preserving
  the prior RIGHT; redo restores UP. A blocked queued RIGHT is tried and
  its count rolled back, then the prior successful RIGHT is undone instead.
  Empty-past Undo returns false before flushing (UndoManager.cs:110–143).
- Restart flushes the queue, then pushes a restart turn with count0. Undo
  restart restores the post-queued position/count: captured past[0,2,1]
  becomes past[2,1], future[0], player(3,3), count2.
- Redo does not flush. When future exists, redo restores its saved count
  and position; UndoInput then clears the pending queue. When future is
  empty, redo returns false and the queue survives. Pending acceptance
  preserves redo history; a later successful physical impulse clears it.
  UndoManager.cs:146–163,431; UndoInput.cs:successful-redo branch.

The redo cancellation reproduction is setup LEFT DOWN UP UNDO, then
LEFT:20 RIGHT:20 REDO:30 NONE:250. LEFT's blocked bump preserves future[3];
RIGHT accepts a reservation during that bump. Successful redo restores
UP to(1,2), count3, then cancels RIGHT without executing it. These instrumented
captures preserve exact delivered controls, original direction/repeat fields,
stack counts, per-action method phases and matched frame PNGs.

## Delivered input boundary matrix

input-boundary-replay.json catalogs eight further native captures, with every
delivered control mask and actual deltaTime (301 updates total). Requested
RIGHT durations25/95/105ms yield actual UNDO delivery59.407/117.034/134.934ms
in these captures. The pre-undo animations are NORMAL t=.0427308, BUMP_HALT
t=0, and BUMP_HALT t=.0166619 respectively. All undo to(2,2), count0,
future[1]. Names describe requested timing, not exact delivered milliseconds.

The simultaneous UP+RIGHT case produces native dirs=Up,Right and selects
RIGHT; UP+DOWN produces Up,Down and selects DOWN. With one key already
held, the newly added direction is appended: Right then Up yields Right,Up.
Releasing the newer key reveals the older held direction without overwriting
an already accepted queued step. This follows Movement.cs:1453 onward:
new directions are visited Up,Down,Left,Right; the last list entry wins.
Undo/redo return before updating this stack, so it remains stale while a
history key is held, until an ordinary movement update processes releases.

first-blocked-held-release-phase-20261025 starts after setup RIGHT. Each
300ms held RIGHT produces exactly one blocked impulse, reserves count2 then
returns it to1, and keeps history[1]. Release NONE clears the blocked flag;
re-press produces one new bump. No repeated blocked impulses occur while
the same direction remains held. Exact samples include original repeat and
history cooldown fields; assertions validate these properties.

## Native coordinate and color submission measurements

native-render-submission-summary.json preserves original same-frame ticket
doubles, SetDrawRect pixel rectangles and raw GUI colors for three sizes.
At800x600, root geometry is(400,300,491.9999957084656,491.9999957084656).
At1001x733 it is(500,366,601.0599947571754,601.0599947571754); at1280x720
it is(640,360,590.3999948501587,590.3999948501587). In these measured native
paths, size equals min(screen)*0.8199999928474426, the float32 representation
of0.82; the product is not rounded back to float32. Odd screen centers use
integer division. This is a measured rule for this calculation, not a blanket
claim that all original arithmetic uses double precision.

The800x600 root border draw rectangles are(154,54,3,491),(642,54,3,491),
(154,54,491,3),(154,542,491,3). Both edges are truncated by SetDrawRect.
The native first root color GUI RGB is(.0720000044,.0720000044,.0720000044);
player border(.063,-.0126000028,.0327600278); gold(.09,.05544,.00359999668).
Screenshots corroborate their distinct dark colors. Internal_DrawTextureArguments
uses managed Color, not Color32. ExplicitColor32Candidate in evidence is only
an observed conversion candidate and does not prove the native vertex format.

Third-level player and gold FilledWithWalls interiors are both1x1 at runtime.
LoadLevel.FillLevelWithWalls:910–915 calls ResizeAndClear(1,1), creates one
wall, then sets FilledWithWalls. DrawBlock's colored backing is followed by
an actual wall ticket covering it. The player's wall GUI RGB is
(.486825883,0,.292095721), not its backing(.219071656,0,.131443083),
which explains the settled approximately(189,0,113) wall body.

gpu-wallbig-keyboard-v2-20261025 contains31 neutral original GPU textures:
WallBig13, WallBigFlip13, keyboard Z/X/R/Escape and MouseZoom. A separately
marked earlier27-file capture omitted the key textures because their config
names are keys, not action names. gpu-eyes-buttons-gradient-20261025 adds17
specifically requested eye/button/gradient/ArrowKeys/WASD fields. Original
field names, source formats, sizes and PNG hashes are retained. These are
source readbacks, not a claim that unexamined AssetRipper textures are exact.

## Held undo/redo scheduling and interruption

`history-repeat-replay.json` preserves four new native captures, 581 actual
delivered updates, initial scheduler state and each completed update state.
`history-repeat-summary.json` indexes every attempt and its matching PNG.
`python scripts/parity-original/summarize-history.py` checks all 581 scheduling
transitions against `UndoInput.Update`; float32 spacing, absolute next time
and previous-direction flag all match exactly. Requested command durations
remain requests only; the replay uses actual delivered masks and deltaTime.

Native scheduling uses strict `Time.time > nextUndoTime`. Each eligible
attempt subtracts float32 .005 from spacing before scheduling, so the first
gap is .145000011, not .15. Continued attempts clamp at .04. The long capture
includes 58 empty-history attempts: failure still accelerates and schedules
the next attempt. UNDO wins when both history controls are held. Switching
UNDO to REDO does not bypass the current deadline; the next eligible attempt
resets spacing to .15 before decrementing it. Releasing both controls sets
next time to current Time.time and spacing to .15, but retains the private
direction bool. Movement keys do not reset that history cooldown while a
history key remains held.

`World.UpdateInner` calls UndoInput.Update before checking restartPressed
(World.cs:1053 onward). Consequently UNDO+RESTART can restart during the
repeat cooldown. When REDO and a fresh RESTART occur in an eligible update,
Redo executes before RestartLevel in that same update. Restart remains an
edge-triggered input; holding it does not repeatedly restart the level.

## Fresh automatic-load player eyes

`first-win-player-drawflags-20261025` repeats the isolated automatic
first_puzzle to second_puzzle transition without changing the persisted save.
At GoToLevel postfix, native frame 51341, the new player is at (4,2) with
IsPlayer=true, DrawIsPlayer=true and Possessable=true; animation is NORMAL
with t=0 and length=0. `frame-0093.png` is that same native frame and visibly
has filled dark player eyes. The save-isolation audit confirms the disk hash
is unchanged and the earlier in-memory save was restored.

This is explicit initialization, rather than an eventual settled-frame repair:
LoadLevel.cs:503–505, 547–549 and 761–763 set DrawIsPlayer alongside IsPlayer
for each relevant parse branch. Draw.DrawFace starts from
`block.DrawIsPlayer || facePhantom` and only chooses PossessEye when that
flag is false. Block.cs:431–433 later synchronizes the flag when not Moving;
Movement.Impulse also synchronizes it before movement.

## Starting-revision hard-path inventory

`hardpath-native-index.json` catalogs ten additional actual native outputs
(250 checked 800x600 images), their original source gates, concrete levels
and selected camera phases. These are references, not Web parity approval.
The f8e7539 Web DrawStyle enum contains Normal, TuiColor, Grid and QuickAnim.
Native raw TUI1 has neither an official level/parser selector nor a matching
implemented baseline Web enum branch; `draw_style tui` selects TUI_COLOR2.

- GRID: grid_clone and shed_multi_simultaneous. Representative fresh static
  and successful RIGHT motion: style-grid-clone-static-20261025 and
  style-grid-clone-right-motion-20261025.
- TUI_COLOR: text_1, text_3, text_clone_v2, text_eat_v2, text_flip, text_poswall.
  Representative fresh text_1 static and successful UP motion:
  style-tui-color-static-20261025 and style-tui-up-motion-20261025.
- QUICK_ANIM: oldstyle_lock_two_doors, oldstyle_squash_4_sides_v2,
  oldstyle_transfer_then_save. Representative first level fresh static and
  successful RIGHT motion: style-quick-anim-static-20261025 and
  style-quick-right-motion-20261025.

Draw.UseGridOrTUIDrawStyle requires Playing or Paused, !EndZoom and
!ScreenshottingBlocks. Native7-key selection cycles NORMAL→GRID→TUI_COLOR,
then NORMAL (oldstyle levels insert QUICK_ANIM).

Clone route: fresh clone_first_2, DOWN DOWN DOWN, then timed DOWN. In
clone-fourth-down-entry-20261025, history-before:TurnCompleted frame1125
has cloneEntry=true and an accepted Enter from level0 to level1. The flag
checks native move.toLevelBlock against its SubLevel.GetExitBlock. Original
Draw.cs2952 uses that same noncanonical-representation distinction; animated
cloneFade also depends on the camera/justEnteredArray gates recorded in the
index. The reference preserves the actual entering-camera output.

Inspection: fresh third_puzzle, left-click inner box at grid(4,6), then
right-click out. Native block identity is56; root is0.
inspection-third-push-pop-20261025 invokes original World.PushInspect and
PopInspect entrypoints, then captures original interpolation naturally; it
does not claim a mouse UI input replay. Both native camera transitions are
.5s, with focus56 then0. World.InspectUpdate additionally requires NORMAL,
no camera/block motion, no hub/win/SpecificBlock; a target child must have a
non-wall-filled SubLevel and not be Moving.

Fixed focus: static-focus-block-static-v2-20261025 proves focusBlock47 at
(400,300), width/height360.00001430511475 =600*Math.fround(.6). Draw.cs1694
selects SpecialEffect1, and1741 uses.6f. The initial capture attempt hung in
the observer's generic newCamT wait: native SpecificBlock does not increment
newCamT. Observer v2 instead waits cameraMoving=false for this mode only; it
does not alter game camera state. The incomplete attempt is not a reference.

## Proven infinite exit, distinct from generated-zone entry

Fresh infexit_ref_first: DOWN LEFT LEFT DOWN RIGHT RIGHT RIGHT RIGHT RIGHT.
infexit-proven-crossing-20261025 captures the final RIGHT after eight setup
actions. At history-before:TurnCompleted frame24545, block23 has accepted
type Exit, infExitNum0, fromLevel0→toLevel0. This is the source achievement
predicate (Movement.cs176). This level preplaces the infinity-exit reference,
so WentToInfZone need not become true; that flag is not an infinity-exit test.

Important trace limit: TurnCompleted recomputes/reuses Movement.moves, so
posthistory/impulse-after scratch records need not preserve the accepted
attempt. Use history-before:TurnCompleted. The existing22-action matrix walk
has no strict infinite Exit in the pure engine analysis; the nine-action
route now has direct native proof instead. The index clearly labels that
walk analysis as engine analysis rather than an additional native replay.

gpu-infinity-effects-20261025 adds exact native InfParticleTex and
InfParticleOutlineTex fields, both512x512 DXT5/Bilinear/Clamp, with neutral
GPU decoded PNGs and SHA256 audit. These supply infinity/epsilon glyph
textures; their rendering gates remain governed by Draw.DrawInfEffect.
