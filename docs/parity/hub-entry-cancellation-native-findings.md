# Native Hub entry and cancellation lifecycle

Date: 2026-10-25. This read-only investigation reuses existing native evidence. It adds no native capture or production changes. [hub-entry-cancellation-native-derived.json](evidence/original/hub-entry-cancellation-native-derived.json) contains measured landmarks, separated source-derived rules, and SHA-256 hashes for all inputs. [Hub arrival findings](hub-arrival-native-findings.md) cover the reverse return path.

Native source root: F:/AssetRipper_win_x64/parabox/ExportedProject/Assets/Scripts/Assembly-CSharp. Line references below refer to that recovered source tree. Existing capture root: docs/parity/evidence/original. Elapsed times are actual run measurements, not exact frame deadlines for another scheduler.

## Entry intercepts the move before logical placement

Movement.ResolveMove (Movement.cs:1139-1144) calls HandleMovedOnPortal before ordinary movement and returns if the portal was handled. HandleMovedOnPortal (Movement.cs:1322-1378) requires a player and an unlocked LevelPortal floor. It sets Transitioning=true, TransitionCounter=0, TransitionSceneName, and the return offset to the player's current position minus the portal target. It does not move the logical player onto that portal square.

For example, entering the Intro enter portal at (2,4) downward keeps the player at (2,5) throughout JUMP_IN and preserves transition offset (0,+1). The face/body animates from that neighbor square toward the portal. On later Hub return, that same offset selects the neighbor when still empty.

For the normal body branch, initialization is JUMP_IN, Moving=true, T=0, length=GetTransitionLength. Scale targets are 1/9, unlike Hub arrival's initial 0.15. Draw offset targets are (portalX-playerX, -(portalY-playerY)); eyes look along the attempted direction. With q=min(AnimT/length,1), Block.cs:391-398 gives:

    drawX = (portalX-playerX) * q
    drawY = -(portalY-playerY) * q - 4*q*(1-q)
    scaleX = scaleY = 1 + (1/9 - 1)*q

The same frame that creates JUMP_IN proceeds through normal World animation progression. Existing first images already have positive AnimT; there is no entry equivalent of the first-full-Hub-update arrival skip.

eyesJump puzzles instead use a STILL player with DrawIsPlayer=false and HubTransitionEyesJumpingIn=true, plus a face-only phantom targeting the portal at scale 0.15 (Movement.cs:1340-1360). This alternative is source-derived here; the measured Intro puzzles use the body branch.

## Portal attempts increment moves without completing a history turn

PlayerMovementLogic increments MoveCount on reservation. A successful portal impulse remains successful, so World.DoNextMultiPlayerImpulse does not roll that count back. Movement.Impulse suppresses UndoManager.TurnCompleted while Transitioning (Movement.cs:161-204). Therefore entering a portal increments Hub's visible MoveCount without pushing a new undo history turn.

The cancel/reenter trace starts at Hub count 7 with seven past turns. First entry produces count 8, still seven past turns and zero future turns. Cancellation retains count 8/history 7. Reentry produces count 9/history 7. The natural scene load resets the puzzle's move/history state to zero. Portal entry is not equivalent to an ordinary completed grid move for history accounting.

## Undo, Escape, and restart cancellation

UndoInput.Update (UndoInput.cs:23-62) checks strict Time.time > nextUndoTime. If undo is eligible while Transitioning, it calls CancelJumpIn instead of UndoManager.Undo. Afterward it advances the ordinary undo repeat schedule and clears WaitForMoveDirChange. CancelJumpIn itself (UndoInput.cs:102-116):

- Stops current animations and clears all level phantoms.
- Creates a 0.125-second SQUISH_IN_PLACE on the current player, with horizontal orientation iff TransitionXPosOffset != 0.
- Sets Transitioning=false and TransitionCounter=0.
- Resets inspect and multiplayer queue state.

It does not pop history, fill future, decrement MoveCount, reset the held direction/repeat counter, or load another scene. The player remains at its pre-portal logical square. StopAnimations is a no-op for QUICK_ANIM (UndoManager.cs:552-568), so that style has an explicit source-level exception; all captures discussed here are NORMAL.

Escape pressed during Transitioning sets Controls.undo=true (World.cs:987-994), so it enters the same undo scheduling/cancellation branch instead of opening Pause. RestartPressed while Transitioning calls CancelJumpIn directly (World.cs:1054-1058), rather than RestartLevel. The direct restart branch does not execute UndoInput's repeat-schedule update or its post-action WaitForMoveDirChange assignment. These distinctions are source-derived, not separately measured Escape/restart cancellation captures.

SQUISH_IN_PLACE is excluded from AnyBlockMoving (World.cs:1117-1126). Cancellation's visual squish therefore does not inherently lock movement for 0.125 seconds. An eligible subsequent direction can start another attempt while that visual animation is present.

## Cancellation precedes the scene completion check

World update order is movement reservation/application, UndoInput.Update, restart handling, block/floor/phantom animation, AnyBlockMoving recomputation, then transition timer advancement. Transition completion uses TransitionCounter >= GetTransitionLength (World.cs:1131-1138). Eligible cancellation resets Transitioning before that completion test, even on an update whose delta would otherwise cross the threshold.

JUMP_IN is explicitly exempt from Block's ordinary AnimT > AnimLength stop (Block.cs:264); its draw q clamps to 1. The world transition timer owns the load. This differs both from ordinary body animation's strict > stop and from phantom removal's >= test.

This update-order rule is source-derived. The existing portal cancel trace cancels well before 0.5 seconds. It does not prove a native sample exactly at the 0.5-second boundary, and the ordinary first-puzzle boundary captures below are not substitutes for that missing runtime boundary case.

## Direction changes update repeat state but cannot queue during entry

PlayerMovementLogic continues updating the held-direction list, dxLast/dyLast, and direction-change repeat reset while Transitioning. Its explicit Transitioning guard blocks new reservation (Movement.cs:1536-1552). This differs from JUMP_OUT arrival: arrival is moving but not Transitioning, so it can reserve one turn while animation is active.

In hub-enter-direction-change-native-v1-20261025, commands are DOWN:40, RIGHT:700, NONE:300. RIGHT is first observed during JUMP_IN at 69.0918 ms. Twenty right-held Hub update-after records remain unqueued; dxLast=1, dyLast=0, dirs=Right. They do not move the player horizontally in Hub.

## Loaded-puzzle flag ordering creates one queue-only update

World calls GoToLevel before setting Transitioning=false. Consequently level-after:enter observes Transitioning=true, while update-after in that same native frame observes false. LoadLevel resets the multiplayer queue but does not reset AnyBlockMoving. Because the old JUMP_IN was moving at the preceding recomputation, the loaded puzzle frame still reports AnyBlockMoving=true even though the new player is NORMAL with T=0 and length=0. The next full puzzle update recomputes the flag false.

If repeat state is eligible, that next update may reserve a turn while the carried moving flag still prevents application. Application occurs on the following idle update. In the direction-change trace:

| Landmark | Frame | Elapsed ms | Count / queue / moving | Player |
| --- | ---: | ---: | --- | --- |
| Level hook after enter loads | 195379 | 520.980835 | 0 / false / true; Transitioning=true | (1,1), NORMAL |
| Same update ends | 195379 | 520.980835 | 0 / false / true; Transitioning=false | (1,1), NORMAL |
| First full puzzle update ends | 195380 | 544.769300 | 1 / right queued / false | (1,1), NORMAL |
| Reserved right applies | 195381 | 563.232400 | 1 / false / true | (2,1), NORMAL |

All six existing portal runs show the loaded puzzle frame moving flag true and first following update false. The held-down portal/Leave runs generally do not reserve in that first following update because the entry impulse reset the repeat counter and it did not advance during JUMP_IN. The direction-change reset to 1000 makes the right case eligible sooner. No unconditional direction reset or immediate application at the level hook should replace these native semantics.

## Measured cancel/reenter landmarks

hub-enter-cancel-reenter-native-v1-20261025 uses DOWN:40, NONE:80, UNDO:40, NONE:620, DOWN:900, NONE:300. Actual delivered controls and phase records are authoritative; request durations alone are not delivery timestamps.

| Landmark | Frame | Elapsed ms | State |
| --- | ---: | ---: | --- |
| First portal impulse | 195017 | 22.888184 | Hub count 8/history 7; (2,5), JUMP_IN |
| Undo cancellation update ends | 195023 | 158.142090 | Count 8/history 7/future 0; SQUISH_IN_PLACE, T=0.0185579; Transitioning=false |
| Reentry impulse | 195054 | 849.014300 | Count 9/history 7; (2,5), JUMP_IN |
| Natural enter load | 195077 | 1354.522710 | Enter count 0/history 0, player (1,1) |

There are no history-before:Undo/history-after:Undo records in this capture. The first entry did not load a puzzle before cancellation; only the later reentry produces level-after:enter.

## Existing ordinary-move undo boundaries have narrower coverage

first-undo-boundary-{25,95,105}-20261025 all test a normal 0.1-second first_puzzle move. Their directory names describe requested timing, not actual first delivered UNDO times. Actual delivery is 59.4072342, 117.033958, and 134.934418 ms respectively. The first is during NORMAL movement; the latter two are after movement, in BUMP_HALT. All three ordinary Undo calls move the player back from (3,2) to (2,2), change count 1→0, pop past 1→0, and fill future 0→1.

These records corroborate the cancellation/history distinction and input-delivery caution. They do not measure Hub JUMP_IN's 0.5-second completion boundary, nor Escape/restart cancellation, QUICK_ANIM, or eyesJump behavior. The derived fixture labels them ordinaryMoveUndoBoundaries to keep that limitation explicit.
