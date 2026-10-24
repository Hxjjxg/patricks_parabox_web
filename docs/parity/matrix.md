# Input, animation, camera and rendering parity pass

Started 2026-10-25 at `f8e7539` with clean worktree. Full task is the user attachment `pasted-text-1.txt`; completion requires every required case exercised, no confirmed scoped discrepancy remaining, passing checks, independent output review, and incremental commits. Pending/unverified is never a pass.

## Inventory at starting revision

Pure TypeScript movement/history, recursive enter/exit/push/eat/possess/shed/infinite zones; horizontal camera flips; procedural NORMAL/ENTER_EXIT/BUMP/BUMP_HALT/NUDGE/STILL/JUMP_IN/JUMP_OUT/SQUISH animations, phantoms/particles; keyboard queue/repeat, touch and inspection; undo/redo/restart; hub/puzzle transitions; PixiJS recursive textures/masks/camera; draw-style and special-mode paths. Existing fixture state hashes do not prove visual or timing parity. Documented partial clone clipping, clone fade, special visuals and wall-flip paths remain in scope where implemented; audio is outside this pass.

## Reference and capture contract

- Original executable/instrumentation: `F:\Patricks.Parabox_inject_debug`; never modify the Steam installation. Original state fixtures: `tests/fixtures/original` and `original-hub`; C# and exported assets establish mechanisms, not screenshot approval.
- Fresh level load, identity orientation unless scenario explicitly specifies a flip; particle/random/frame differences must be separated from deterministic geometry. Record actual viewport, DPR, board bounds, camera scale, original render size, commit, and timestamps with every capture.
- Static viewports: 800×600, 1280×720, 1001×733; DPR 1 and 2 on Web. Include integer tile scales and fractional tile scales explicitly. Native original has no browser DPR; compare in physical board coordinates.
- Motion phases: before accepted action, start, intermediate (~25/50/75% of action), landing, next queued start. Align by measured action timestamps and normalized phase, not unrelated frame number. Establish tolerances from repeated original captures before judging pixels/timing.
- Shared UI ownership: main initially owns original and browser; agents require explicit handoff before scene/input changes.

## Level/state matrix

| ID / family | Fresh starting state / deterministic sequence | Required observations | Result / evidence |
|---|---|---|---|
| first_puzzle / first | fresh; R; RESTART; UNDO; REDO | static walls, push, history, restart | unverified; existing state fixture available |
| second_puzzle / second | fresh; U R D L, restart between independent probes | static rendering, blocked and successful moves | unverified |
| third_puzzle / third | fresh root 9×9, player(2,4), inner box(4,6); R U L D | baseline highlights, corners, wall connections, seams; motion/scaling | unverified; first priority |
| enter / enter-exit | R U U U L U R R R R | motion origin, clipping, camera crossing and nesting | unverified; focused state fixture available |
| carry / nested push | walk sequence below | player/box continuity, nested walls | unverified; state fixture available |
| cycle_line / recursive | walk | recursive projections, nested seams/clipping | unverified; state fixture available |
| infenter_first_2 / infinite enter | walk | recursive scale, ghosts, camera continuity | unverified; state fixture available |
| infexit_ref_first / infinite exit | walk | recursive exits, camera continuity | unverified; state fixture available |
| infenter_zone_v2 / generated infinity | walk then R×5 U×5 L×5 D×4 | generated zones, projection continuity | unverified; focused fixture available |
| infenter_zone_v2 / proven generated infinity route | fresh; D D D U | actual generated-zone entry, camera/projection and history | native snapshot proves wentToInfZone=true atmoveCount4; new per-action hash fixture passes; visual/timing comparison pending |
| flip_first / horizontal flips | R D D R R | orientation, wall lighting and camera movement | unverified; focused state fixture available |
| 1by1_playerr_flip2 / boundary flip | DDRURLUDDLUDDLRUDRUDLDRDULDRRRD | camera-boundary flip interpolation | unverified; cameraFlip test available |
| possess_first / possession | L D D L L | face/phantom origin and jump phases | unverified; focused state fixture available |
| eat_same_side / eat | L L | enter/eat projection and nested rendering | unverified; focused state fixture available |
| shed_first / shed | R R R R U U | moving shell, projection and animation continuity | unverified; focused state fixture available |
| hub / transitions | empty save; first→second→third→enter portals; win/restart and return | camera, state reset, queued input across transitions | unverified; hub state fixtures available |

Walk = U R D L R R U U L D R U L L D D R U R D L U. Start positions must be recorded from authoritative snapshots, and actual action effects checked rather than assuming a sequence reaches its named mechanic.

## Input/timing matrix (apply to first three and relevant mechanic cases)

| Case | Sequence / boundary | Required result | Status |
|---|---|---|---|
| tap | press/release each direction | one impulse, measured original timing | unverified |
| hold | same direction ≥1s in open corridor | landing + repeat delay cadence | unverified |
| rapid turn | direction change at 1/25/50/99ms and landing | at most one queued; no mid-slide state jump | unverified |
| alternating | L/R with U/D near next-frame window | immediate anyBlockMoving refresh; correct motion origin | unverified |
| blocked | hold wall direction, change direction | repeat suppression and correct bump phases | unverified |
| release/repress | same direction after blocked and after landing | original re-arm rules | unverified |
| undo / redo | idle and during slide, repeated presses | grouping, squish, camera sync | unverified |
| restart | idle and during slide; undo restart | original instantaneous/reset rules | unverified |
| transition | held/queued direction across win and portal | original reset/acceptance/camera rules | unverified |
| variable frame intervals | 8/16.7/25/50/100ms; press inside frame | post-press delta only, correct start/landing and queue | existing regressions; parity unverified |

## Findings / next experiment

1. Third level identity independently confirmed by puzzle_data labels a1/a2/a3 and portal links first→second→third→enter.
2. First experiment: capture original and untouched Web third_puzzle at rest, then compare wall UV orientation, alpha coverage, autotile topology, filters and exact geometry before choosing fix.
3. Baseline `npm test`: 20 files / 155 tests pass. No production changes at baseline.
4. Untouched Web rest capture: `evidence/web-third-before-800x600-dpr1.png`; phase captures and actual frame/event timestamps: `evidence/web-third-before-motion/trace.json`. Capture harness: `scripts/parity-capture-web.js`. At the recorded fresh load, player=(2,4), camera=(0,0,1,1), canvas800×600 and CSS800×600, DPR≈1, particles enabled, animation skipping false, move delay70ms. R U L D returns to (2,4), moveCount4. These establish Web evidence, not an original parity pass.
5. Initial original ScreenCapture attempts produced entirely black images despite a valid third_puzzle state. They are rejected as visual evidence. Investigator is repairing framebuffer capture via a visible launch of the debug installation. Native CUA capture was not approved by the runtime; no competing UI helper is used to bypass that rejection.
6. Visible debug launch and startup settling produced valid native reference `evidence/original/third-baseline-settled-20261025/`. Original repeated static ROIs are pixel-stable. Independent review establishes interior-channel tolerance1; particles, outline geometry and edge AA require separate comparisons.
7. Wall candidate:11 regressions pass, including demonstrated pre-fix failures for contrast/raw textures/sampler/mirror/snapping and exact third-level float-cancellation cases. Repaired800×600@1 white bevels match255; base/dark bevel channels differ at most1; original seam row272 and column372 are uniform. Main real Canvas capture: `evidence/web-third-after-800x600-dpr1.png`. Fractional/DPR/motion review is ongoing, not a blanket pass.
8. Native timing artifacts now cover first tap/hold/rapid/alternating/repress/history, third tap, enter/exit/nesting/flips and genuine infinity entry. Direct setup cameras need full settling; affected v1 artifacts are diagnostics only. Native animation phase conformance tests cover actual first/right and third/up measured NORMAL+BUMP_HALT frames.
9. Confirmed separate discrepancy: floor gradient .08 Web vs native effective .16 (native shader doubles alpha). Large≥256px WallBig branch and border differences remain open; full scope is not complete.
