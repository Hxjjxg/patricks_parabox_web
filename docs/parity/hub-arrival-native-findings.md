# Native Hub arrival: placement, animation, and input queue

Date: 2026-10-25. This investigation reuses existing native captures; it does not introduce a new native run or alter the game. The compact extraction is [hub-arrival-native-derived.json](evidence/original/hub-arrival-native-derived.json). Capture timings below are measurements from those runs, not fixed transition deadlines for a different frame schedule.

## Source and evidence

Native source root: F:/AssetRipper_win_x64/parabox/ExportedProject/Assets/Scripts/Assembly-CSharp. Resource root: the adjacent Assets/Resources directory. These are AssetRipper-recovered sources, checked against the runtime phase/draw records below.

Existing evidence root: docs/parity/evidence/original. The relevant captures are intro-third-win-held-native-v1-20261025, intro-third-win-restart-undo-native-v1-20261025, and hub-{first,second,third,enter}-portal-leave-native-v1-20261025. Their original phases.json, capture.json, probe.json, and PNGs remain unchanged. The derived fixture includes SHA-256 hashes for those inputs and source files.

## Explicit Hub returns start the arrival animation

World.GoToNextLevel(bool) (World.cs:1527-1548) directly loads an immediate next puzzle on its first win, unless that destination is already won. Only the fallback sets doJumpOut = true and calls GoToHub(). Resources/puzzle_lines.txt declares first_puzzle → second_puzzle and second_puzzle → third_puzzle immediate; third_puzzle → enter is not immediate. Therefore direct first → second → third loads retain their normal scene-load behavior. The arrival jump belongs to the explicit return branch.

PauseMenu's Leave puzzle action (PauseMenu.cs:563-585) also sets doJumpOut = true. Its input reset is deliberately different: WaitForMoveDirChange = true; dxLast = dyLast = 0; an active up/down control may set dyLast to +1/-1. It then loads Hub and calls SetCameraUnpause(leavingPuzzle: true). The measured Leave captures used delivered menu controls, not a direct observer GoToHub call.

## Recent puzzle placement precedes saved-area startup placement

Every non-Hub load assigns World.RecentPuzzle (LoadLevel.cs:198-200). Hub.PositionPlayerOnHubStart first checks RecentPuzzle and locates its matching portal (Hub.cs:337-400). It calls ComputeDelta, stores the chosen dx/dy back into World.TransitionXPosOffset/YPosOffset, and moves the player to portal + (dx,dy). It also updates xposStart, yposStart, and OuterLevelStart. Only when RecentPuzzle is null does the saved RecentArea fallback choose the area's default startup position (Hub.cs:402-440).

ComputeDelta (Hub.cs:444-505) first tries the existing transition offset if the destination is empty. It then tries down, up, left, right while requiring the opposite side to be nonempty, followed by up, down, left, right without that opposite-side restriction. The fallback is (0,-1). SpaceEmpty requires in-bounds coordinates and no block or floor. Portal entry saves the player's position minus the portal position as the transition offset (Movement.cs:1321-1338); entering downward from the square above therefore preserves (0,+1).

RecentArea does not override a return's portal placement. World.cs:1265-1272 subsequently updates SaveFile.Current.RecentArea from the player's actual outer level. UndoManager.UpdateIndexAreaName (UndoManager.cs:452-472) only updates the Index area's display name/animation from the block immediately below the player; it does not reposition the player.

Native observer outerLevel is World.levels.IndexOf(player.OuterLevel), not a source-file level ID (scripts/parity-original/Plugin.cs:261,1592). The observed native Hub runtime reports outerLevel 0; the Web full-Hub model uses its own allocation/index order (reported as 47 in the comparison). Compare Area_Intro, matching portal, and local coordinates rather than treating these integers as the same identity. Both source Hub assets define the detached 11×11 Intro block with special effect 6; Web levelParser.ts:154-157 explicitly labels it Area_Intro.

## Body jump initialization and curve

After placement, doJumpOut is consumed once (Hub.cs:352-396). For puzzles whose eyesJump flag is false, initialization is:

- Moving = true; Anim = JUMP_OUT; AnimT = 0.
- AnimLength = World.GetTransitionLength(); AnyBlockMoving = true.
- DrawXScaleStart = DrawYScaleStart = 1.
- DrawXOffsetStart = -dx; DrawYOffsetStart = dy.
- PlayHopOut; PlayerLookPortalExit; UpdateAnimation(false,false) immediately.

World.GetTransitionLength (World.cs:1847-1849) delegates to Projection.GetEnterLength (Projection.cs:320-331): TUI/TUI_COLOR use 0.1 seconds; synchronized camera uses EnterLengths[Prefs.EnterSpeedIndex]; other camera modes use EnterLengths[0]. EnterLengths is [0.5, 1/3, 0.25, 0.75]. The measured normal arrival length is 0.5 seconds.

For q = AnimT / AnimLength, Block.cs:400-406 gives:

    drawX = -dx * (1 - q)
    drawY =  dy * (1 - q) - 4*q*(1 - q)
    scaleX = scaleY = 0.15 + 0.85*q

Thus q=0 already has a 0.15-sized body at the portal-relative offset, rather than a full-sized idle body. The direct third setup carries the default offset (0,-1): local target (4,5), draw offset (0,-1). The delivered portal→Leave path carries (0,+1): target above the portal, draw offset (0,+1).

Completion is strict AnimT > AnimLength, not >= (Block.cs:260-286). Landing clears WaitForMoveDirChange, plays the landing sound, and StopMoving resets draw offsets/scales. It may create BUMP_HALT. AnyBlockMoving explicitly excludes BUMP_HALT and SQUISH_IN_PLACE (World.cs:1117-1126), so the landing bump does not block the reserved turn.

PlayerLookPortalExit (Hub.cs:516-535) initializes the eyes toward the dominant exit axis: horizontal sign(dx)*0.08 or vertical -sign(dy)*0.08. Current and target eye offsets are set immediately, and LookAnimT is zero. Default third return points the eyes at y=+0.08; a return from above uses y=-0.08.

## First Hub update skips animation, not input

LoadLevel.cs:202-204 sets FirstFrameInHub = true. At the next World update, World.cs:875-880 consumes it into a local flag. Movement.PlayerMovementLogic still runs (World.cs:1034). A queued impulse is applied only when multiPlayerQueued && !AnyBlockMoving (World.cs:1047-1049). The local first-frame flag only surrounds the animation block (World.cs:1074-1114), including block, floor, area-name, and phantom progression. It does not early-return from the world update or clear the held direction/repeat counter.

This distinguishes the load frame from the first full Hub update. In the third held-right capture:

| Landmark | Native frame | Elapsed ms | Move count / queued | Player / animation |
| --- | ---: | ---: | --- | --- |
| Hub loads | 1155050 | 1610.59570 | 0 / false | (4,5), JUMP_OUT, T=0 |
| First full Hub update, after movement | 1155051 | 1649.10889 | 1 / true, right | (4,5), JUMP_OUT, T=0 |
| Next update | 1155052 | 1670.53223 | 1 / true | (4,5), JUMP_OUT, T=0.0214181 |
| Landing, after animation | 1155076 | 2159.30176 | 1 / true | (4,5), BUMP_HALT, AnyMoving=false |
| Reserved impulse completes | 1155077 | 2179.80957 | 1 / false | (5,5), NORMAL; one history turn |

Images frame-0083.png and frame-0084.png both have draw offset (0,-1) and scale (0.15,0.15). Frame-0085.png has drawY=-1.12116885 and scale=0.18641077, consistent with the body curve. The first full Hub update can reserve a turn while the arrival is still at T=0.

## Repeat reservation and application are separate

PlayerMovementLogic (Movement.cs:1453-1600) updates the held-direction list and chooses the most recently added held direction. A chosen direction change clears WaitForMoveDirChange and sets moveDelayCounter = 1000. The counter increments only while !AnyBlockMoving, and eligibility uses a strict greater-than comparison with Prefs.MoveDelay * 0.001. Undo or redo returns before this logic.

AnyBlockMoving itself is not a reservation guard. Eligible movement increments MoveCount and sets the one queued multiplayer impulse even during JUMP_OUT. An already queued impulse blocks another reservation when AllowSkippingAnimation is false (the measured configuration). The movement phase therefore reserves one right turn on the first full Hub update while application waits for landing. A blanket animation input lock would lose this native queue behavior.

Reservation does not reset the repeat counter. Movement.Impulse (Movement.cs:125-130) resets it to 0 when the turn actually applies (-0.1 in QUICK_ANIM). The measured counter stays 1.4980104 during the arrival, reaches 1.51851249 just before application, then becomes 0 inside the impulse. The trace is RIGHT:2300 followed by NONE:300; its final single Hub turn is a bounded timeline result, not evidence that holding right forever can produce only one turn.

The win return preserves dxLast, dyLast, dirs, and repeat counter: load frame has dxLast=1, dyLast=0, dirs=Right, WaitForMoveDirChange=false. Do not copy PauseMenu's direction reset into this branch.

## Measured arrival coverage

All rows below have JUMP_OUT, AnimT=0, AnimLength=0.5, AnyBlockMoving=true, draw scale 0.15, native outerLevel=0, and zero Hub moves at level-after:hub.

| Existing capture | Local target | Initial draw offset | WaitForMoveDirChange |
| --- | --- | --- | --- |
| Third win, held right | (4,5) | (0,-1) | false |
| Third win, Restart→Undo | (4,5) | (0,-1) | false |
| First portal, Pause→Leave | (6,7) | (0,+1) | true |
| Second portal, Pause→Leave | (5,7) | (0,+1) | true |
| Third portal, Pause→Leave | (4,7) | (0,+1) | true |
| Enter portal, Pause→Leave | (2,5) | (0,+1) | true |

The Intro portals are first (6,6), second (5,6), third (4,6), and enter (2,4). Default isolated third setup and actual portal entry intentionally produce different return sides.

## eyesJump is a separate branch

Hub.LoadPuzzleData reads eyesJump from puzzle_data field 5. First, second, third, and enter all have 0, so the body branch applies to the coverage above. For eyesJump=true, Hub.cs:355-380 instead makes the player Moving with STILL, hides DrawIsPlayer, and creates a face-only phantom at the target square. Phantom initial position is (-dx,dy), scale 0.15; the default destination is (0,0), scale 1. Phantom.cs:56-79 linearly interpolates these values without the body parabola and removes it at T >= length, playing landing for jumpOut. Block.cs:431-434 restores DrawIsPlayer from IsPlayer once movement stops. Body JumpOut must not be installed unconditionally for all puzzle returns.

## Implementation checks supported by this evidence

- Preserve direct immediate puzzle loads; request the Hub arrival only for the explicit return paths.
- Use the actual chosen placement delta, not an unconditional downward default.
- Initialize the draw at T=0 immediately and skip animation progression on the first full Hub update.
- Reserve at most one default queued turn during arrival; apply it only once arrival no longer contributes to AnyBlockMoving.
- Reset the repeat counter on impulse application, and retain the distinct win versus Pause Leave direction semantics.
- Compare semantic Hub area/local position, not native/Web array indices.

Remaining boundary: the eyesJump branch is source-derived here; the six measured body arrivals do not constitute a fresh runtime eyesJump capture. No production code was changed by this evidence task.
