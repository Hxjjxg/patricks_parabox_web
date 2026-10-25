# Hub caption lifecycle source audit

2026-10-25. Scope: local recovered C# and current TypeScript only. No native deployment, relaunch, font extraction, browser control, or native UI action occurred in this task. Production integration remains with main. New isolated mechanism files: src/core/hubCaptionState.ts and tests/hubCaptionState.test.ts. They are not wired into the game.

## Immediate correction: native reference names drop the prefix

Hub.cs114–123 parses the seventh puzzle-data token as referenceName=array2[6].Substring(1), and preserves the raw token separately as referenceNameWithOldLetter=array2[6]. Current progression.ts39–69 retains that raw token as referenceName. Therefore hubPausedPortalReference currently requests a1 for first_puzzle, while native DrawPortal requests **1**. Intro native labels are **1…9**, not a1…a9. The native celebration index also uses int.Parse(referenceName)-1.

A read-only scan of all364 local puzzle-data rows finds raw characters 0123456789Labcdefghijkmnopqrstuvw. After native one-character removal the character set is **0123456789**, and every suffix is numeric. Normalize once in metadata parsing, optionally preserving a separate old-letter field. Do not strip an already normalized numeric reference twice. This corrects the earlier a1…a9 and raw-letter coverage assumptions in native-font-hub-18-24-findings.md; that existing file is outside this task's new-file ownership.

## Load-time state and ownership

All native file references below are under F:/AssetRipper_win_x64/parabox/ExportedProject/Assets/Scripts/Assembly-CSharp/.

| State | Source initialization / persistence |
| --- | --- |
| Per-wall counts | LoadLevel1190–1247 initializes fresh Hub wall counts as below |
| Per-wall animation | Block124–146: Unlocking=false, UnlockingT=0, UnlockingLength=1.75f, suppressSound=false; Counting=false, CountingT=-2.5f, totalDelta=delta=0, scaleT=0 |
| Global unlocking | LoadLevel98 resets false on every level load |
| Global celebration | LoadLevel99–103: false, t=-1.25f, playedStartSound=false, level=null, numLevels=0 |
| Area-animation histories | LoadLevel1080–1087: when hubLoaded was false, clear wallUnlockAnimPlayed and celebrationPlayed, set hubLoaded=true, and suppress this first Hub load's animations; dictionaries otherwise survive Hub reloads |
| Global counting | Source assignments are only LoadLevel1299 true and Block540 false. **LoadLevel.Load does not reset counting.** |
| Newly won accumulator | World1192 increments only newly won canonical puzzles, including immediate next-puzzle chains. LoadLevel1290–1303 consumes/resets it when >0 on Hub modification; developer toggle World1747 can also increment it. |

Animation histories belong to the session/save-selection lifecycle rather than serialized progress. Native resets hubLoaded in PauseMenu557/793 and World1781; connect history resets to those corresponding existing save/session paths, not every Hub load.

### Count calculation and start

hubShortcutCounts already models static counts. Ordinary numerator counts **all won portals**, denominator counts canonical metadata hard==0 portals, minus one in Area_Swap and Area_Wall. Retain uncapped won count, then cap display count from above only. No lower clamp is added. *all uses Hub.puzzleData.Count and SaveFile.LevelWon.Count, including wins absent from visible floors. *clear and *clear_or_unlock_all do not initialize a fraction. Ordinary unlock-all bypass does not initialize counts.

After wall unlock decisions/removals, if levelsNewlyWon>0, LoadLevel1290–1303 scans retained walls in reverse order. A qualifying wall is plain, has a nonnull unlocker not beginning with *, and belongs to RecentArea. It assigns Counting=true, totalDelta=levelsNewlyWon-(numSolvedUncapped-numSolved), delta=totalDelta, and World.counting=true. **Do not clamp or skip zero/negative deltas.** CountingT stays its default -2.5f on the fresh wall. The pass then sets levelsNewlyWon=0 even if no wall qualified.

Draw numerator is numSolved-CountingDelta only while Counting; otherwise numSolved. Denominator is numRequired. Numerator and denominator are two separate labels with a rectangular separator, not a slash glyph.

### Open route versus retained wall

LoadLevel1249–1288 retains an eligible open ordinary wall for animation only if its area animation is unplayed, not unlock-all, not first Hub load, and not a special * clear. Otherwise it removes the wall immediately. Open walls mark area history true; a closed ordinary wall removes that area history key. Reverse traversal and Area_Center's flag5 exception let additional Center walls animate together while suppressing later Center sounds; do not replace this with generic per-area deduplication.

During animation the wall still occupies its collision/grid cell, while the native route record is already open=true. Gateway-above accepts **absent OR Unlocking** (LoadLevel1323). Hard==2 with no incoming line ignores Unlocking walls when checking remaining closed shortcuts (1344–1354). Current progression.portalUnlocked only accepts absence and treats every retained wall as closed. These predicates must change together with delayed removal, or retaining walls regresses portal flags and paused labels.

## Native update sequence

World reads and consumes FirstFrameInHub before dispatch. The paused/credits/break/travel/gallery/show branch (881–984) updates floor animation and returns before wall timers and global celebration clock. Escape opening Pause (986–1029) also returns before those stages.

Eligible playing order:

1. Movement/history before animation. Movement1550 blocks movement for global unlocking or celebrationLevel!=null, **not counting alone**.
2. Unless FirstFrameInHub, iterate World.blocks **forward**: UpdateUnlocking if that local block.Unlocking, then UpdateCounting on the same local reference, then eligible movement animation. Removal mutates the list: normal for-loop increment skips the shifted next entry. Do not substitute a copied array, index repair, or aggregate OR flags without changing source behavior.
3. Unless the same first-Hub skip applies, update floors using the previous global celebrationT.
4. Later win/transition code may load another level/Hub.
5. World1240–1258 advances the global celebration clock. **This stage is not gated by FirstFrameInHub.** It can run on a tick whose earlier block/floor loops were skipped or whose later win logic just loaded a Hub.

Source float arithmetic is rounded through Math.fround in the new helpers. Timers need the full applicable native deltaTime, not movement animation's sinceMove delta or an arbitrary .1 cap.

### Block counting / unlocking

- Block489–511: if World.counting, unlocking returns immediately. Otherwise add dt. At UnlockingT>=UnlockingLength remove the cell, World.blocks entry, and level.blockList entry; set World.unlocking=false; emit12 block particles and optional wall-pop sound. The removed object's Unlocking flag is not cleared; World still calls UpdateCounting on that local object in the same iteration.
- Block513–541: save old CountingT; add dt/.3f. If newT>=1 and floor(oldT)!=floor(newT), emit **one** pop even if several boundaries were crossed. Pitch=(numSolved-CountingDelta)/(numRequired-1), before decrement, except required==1 gives1. Set scaleT=1, decrement delta once, emit3 block particles. The same suppressSound flag controls this pop's audio.
- Completion is strict newT>totalDelta, **after** the pop branch. Set this wall.Counting=false and World.counting=false directly, even if another wall is still Counting. Keep source order rather than reconstructing global counting as an OR.
- Still in that call, positive scaleT subtracts dt/.2f, clamped only below0. A newly triggered scale has already decayed when rendered. A large delta can consume the scale immediately.
- For ordinary deltas, default CountingT=-2.5 suggests roughly1.05 seconds to first pop, then roughly.3 seconds between pops. Preserve float thresholds rather than replacing this with scheduled timestamps.

DrawWall expands **both body and captions** by Lerp(1,1.5,scaleT²). Body RGB uses unlock Lerp(1,1.65,T/Length); fraction RGB separately uses Lerp(1.5,6,T/Length). Geometry alone does not implement brightening. Native quick-animation wall drawing still reaches the subsequent fraction; a local early return must not suppress eventual captions.

## Celebration and pause references

LoadLevel1097–1153 considers an area complete only if it has at least one portal and **every portal is won**, including hard/visual portals. This differs from reaching the shortcut core-count threshold. A newly complete area outside the first Hub load sets celebration=true and attaches celebrationLevel. Portal index=int.Parse(normalizedReferenceName)-1 and celebrationNumLevels counts those portals. Area history is marked whether or not animation plays, and removed when incomplete. Keep the literal single global level/clock: if several areas newly qualify in one pass, the later area replaces the pointer while portal counts accumulate; the source does not create a queue.

Floor201–215 runs when portal.OuterLevel==celebrationLevel, including paused floor updates. An unpopped portal pops when float (celebrationT/2.6f)*(numLevels-1)>=index. It emits3 portal particles and sound pitch index/(numLevels-1), with **no numLevels==1 guard**. Once popped, celebrationSizeT adds dt in the same call and every subsequent matching-level call. Level identity alone gates this method; no independent celebration/counting/unlocking/playing check exists.

Therefore pause freezes the global clock but **does not freeze already popped portal size timers**. A currently eligible unpopped portal can also pop using the frozen clock. Clearing the level pointer stops its timer.

World1240–1258 advances the clock only if celebration && !unlocking && !counting. Crossing0 sets playedStartSound=true; the recovered branch contains no actual sound call. At >=3.25f, if level!=null, spawn edge particles, clear the pointer, and play the big pop. Then celebration=false and t=0. DrawPortal's visual scale settles after.5 seconds, but celebrationSizeT itself has no .5 clamp.

The existing hubPortalCelebrationGeometry expands the full cell. That same expanded cell must control portal body, hard backing, paused label font size, and shadow offset. hubPausedPortalReference requires ordinary Pause, not InBreakMenu, floor.Unlocked, and expanded width/height strictly>10. It reads normalized native referenceName; it does not require !World.unlocking. Shadow black then foreground white, both MiddleCenter. Recompute from the **current pause camera physical geometry**, rather than caching ordinary-view size.

## Minimal production integration callsites

| Existing owner / callsite | Required connection |
| --- | --- |
| progression metadata parser | Normalize native reference once; preserve old-letter value separately if wanted |
| ProgressionModel.markWon / controller win transition | Accumulate new wins across immediate chains; keep area animation histories through Hub reloads and reset on appropriate session/save changes |
| ProgressionModel.applyToHub339–423 | Initialize counts before removal, select retained Unlocking versus immediate removal, initialize counting after that pass, update route-open and portal predicates consistently; current code removes every open wall immediately |
| WorldModel / per-object transient state | Wall timers; global counting/unlocking; attached celebration level/clock; per-portal celebration fields. Keep these separate from undo/persistent progress. hubUnlockWalls history is not proof a wall remains drawable. |
| GameController.onAnimationFrame1339–1458 | Playing block stage with native iteration/removal and full timer delta; floor stage before global clock; playing-only first-Hub skip; movement gates. Current outer floor skip also affects paused mode, while native paused floors are not first-Hub-gated. |
| WorldModel.updateFloorAnimations591 | Matching-level portal celebration, including paused updates; current method handles only goal/info/demo-end animation |
| GameRenderer.drawWall1460 / drawFloor1393 | Live descriptors and physical current-camera geometry; popped body/caption dimensions and body brightening; expanded portal body then paused label. At audit time production never imports/calls the caption descriptors. |

createHubCaptionWallState supplies defaults. startHubCaptionCounting only implements the qualifying per-wall assignment; caller sets global counting=true. advanceHubCaptionWall returns state, global assignments, removal and effect events. It is **not a complete World scheduler**; the caller must preserve native list-mutation semantics. advanceHubPortalCelebration is the floor stage; advanceHubCelebrationClock is the later clock stage. Load policy, history, level identity, route decisions, removal, particles, sound, movement gates and rendering remain caller responsibilities.

## Validation versus visual approval

The19 new tests pass and TypeScript typecheck passes. Cases cover defaults; capped-away wins including zero/negative deltas; initial delay; one-pop overshoot; strict completion; same-tick and residual scale decay; required-one pitch; global gates/assignments; removal/sound effects; clock gates/completion with and without a level; floor-before-clock order; paused growth; detached state; and source single-portal NaN pitch. These are **source mechanism tests**, not native trace comparisons or visual approval.

No new native image was used. The134 hidden-launch black PNGs remain rejected. Exact native glyph/metrics coverage for13/18/24/25/32/41 remains unavailable, and timer-selected intermediate font sizes may also be needed during a pop. Correct digits-only references do not resolve missing sizes: a null exact-size glyph descriptor remains a coverage gap. Do not scale12/16/20 glyphs or invent metrics. Production ordinary/count/unlock/celebration/pause routes and native/Web visual approval remain open.
