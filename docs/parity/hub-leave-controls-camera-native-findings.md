# Native Leave puzzle: held controls and camera unpause

Date: 2026-10-25. Three fresh native runs use existing observer V14, actual Pause-menu selection/Confirm, an isolated save and the normal first Intro portal. No observer, helper, production controller or renderer code changes occur. Browser ownership remains with the coordinator. Derived data, source hashes and complete per-file SHA-256 manifests: [hub-leave-controls-camera-native-derived.json](evidence/original/hub-leave-controls-camera-native-derived.json).

## Delivered held controls survive Leave

PauseMenu.cs:563-585 changes State to Playing, sets doJumpOut and WaitForMoveDirChange, resets dxLast/dyLast to zero, then copies currently held up/down into dyLast. It calls GoToHub and SetCameraUnpause(true). The action does not clear effective Controls or explicitly reset the repeat counter. Movement.dirs is rebuilt from effective Controls when normal movement resumes; it is empty at the load boundary here, so this report does not claim a populated dirs list survives the paused menu.

Movement.cs:1453-1558 samples held Controls, chooses the direction, clears wait and sets the repeat counter to1000 on direction change, increments the counter only while AnyBlockMoving is false, and reserves only when the counter strictly exceeds configured delay. World.cs:875-880,1034-1049,1074-1114 samples movement on the first Hub update but skips animation advancement. Block.cs:260-286 clears wait on JUMP_OUT landing.

The reproducible setup is isolated Hub save nexus=0 recent=Area_Intro won=, setup RIGHT DOWN DOWN, followed by an actual DOWN portal entry. Timed controls open Escape, wait1100 requested ms for pause settling, select Leave and continuously hold RIGHT or DOWN through Confirm. Exact requests, controls-delivered samples, start/end state, isolation audit and PNGs are retained. Requested milliseconds are not treated as delivered control deadlines.

| Run | Hub load frame | First full Hub update | Landing frame | First post-landing impulse |
| --- | ---: | --- | ---: | --- |
| hub-leave-held-right-native-v1-20261025 | 2642017 | count1, queued=true, wait=false, animT=0 | 2642046 | 2642047: (7,7), NORMAL |
| hub-leave-held-right-repeat-native-v1-20261025 | 2642963 | count1, queued=true, wait=false, animT=0 | 2642989 | 2642990: (7,7), NORMAL |
| hub-leave-held-down-native-v1-20261025 | 2643821 | count0, queued=false, wait=true, animT=0 | 2643849 | 2643850: (6,7), JUMP_IN |

Both RIGHT runs reserve exactly one rightward turn during the first Hub update while JUMP_OUT AnimT remains0; the turn applies on the update after landing. They move (6,7) to(7,7) and continue right while held. DOWN enters Hub with dyLast=-1 and wait=true. All28 sampled flight updates retain wait and reserve nothing; landing clears it. The following update attempts DOWN at the portal, creates JUMP_IN, and reenters first_puzzle at frame2643873. Horizontal and vertical Leave therefore require different direction-reset semantics.

At investigation time, Web GameController.ts:761-762 loaded Hub without preserveControls; activateWorld reset directional state and physicalDirections, and the action footer cleared them again. Menu keydown returned before ordinary physical-direction registration. This is a source discrepancy for the coordinator to fix; this evidence-only module does not edit that implementation.

## Pause camera returns over several native frames

World.SetCameraUnpause (World.cs:1852-1862) enables under its camera/style guards. It maps the previous rendered pause weight into zoomT with 1-pow(lastY,1/8), requesting one skipped delta for Leave. Draw.cs:1146-1159 consumes the skip, then advances zoomT by2*deltaTime and clamps to1. Camera offset changes/resets clear the flag at Draw.cs881,922,932; merely reaching zoomT1 does not clear it in that update method.

Draw.cs:1905-1928 applies QuadOut three times; the unpause pause-weight is (1-zoomT)^8. It blends normal focus fraction with GetFocusFractPause, uses physical integer screen center plus GetControlsOffset, and applies focus-level CamZoomFactor. This camera is separate from the player's JUMP_OUT body animation. At800x600 GetFocusFractPause is approximately0.44857, versus normal0.82 (Draw.cs2591-2602).

PNG blue-ink bounds corroborate a small Hub at load and first full update, then expansion. These exclusive-edge bounds follow the fixture's explicit RGB predicate; they are not unexposed Draw.blockWidthLast. First RIGHT run:

| PNG | Since load (ms) | Blue-ink bounds | Width |
| --- | ---: | --- | ---: |
| frame-0155.png | 0.000 | [268, 168, 531, 431] | 263 |
| frame-0156.png | 22.949 | [268, 168, 531, 431] | 263 |
| frame-0157.png | 42.480 | [238, 138, 561, 461] | 323 |
| frame-0158.png | 60.547 | [216, 116, 583, 483] | 367 |
| frame-0160.png | 95.703 | [188, 88, 611, 511] | 423 |
| frame-0163.png | 150.879 | [167, 67, 632, 532] | 465 |
| frame-0167.png | 223.633 | [158, 58, 641, 541] | 483 |
| frame-0173.png | 332.031 | [157, 57, 642, 542] | 485 |

All sampled camera offset telemetry remains newCamT1/newX0/newY0/newXS1/newYS1 even while the board grows; those fields alone cannot represent pause unpause scale. Both RIGHT runs repeat equal load/first-update blue bounds and subsequent growth. V14 exposes no cameraUnpause, skip flag, zoomT or blockWidthLast, so internal flags are source-derived and no fitted per-frame curve is claimed.

## Limits and end state

Every audit reports persisted-save hash unchanged and in-memory save restored, with suppressed saves recorded. All699 raw frames are800x600. Only RIGHT twice and DOWN once through the first portal are covered. LEFT/UP, simultaneous directions, exact-boundary release, active camera movement, QUICK_ANIM, Title/mobile and OS-key timing remain unsupported. The later tutorial reference module leaves the debug game settled in third_puzzle800x600. No Steam original is touched.
