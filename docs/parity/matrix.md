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
| first_puzzle / first | fresh; R; RESTART; UNDO; REDO | static walls, push, history, restart | exercised: native static3sizes; actual Web static/borders/shadows and12 controlled input cases; wall GPU decode fixed e024f58, body geometry matched in input images; final18-scene static/DPR sweep and tutorial caption approval pending |
| second_puzzle / second | fresh; U R D L, restart between independent probes; focused push setup U then U | static rendering, blocked and successful moves | native static3sizes and second-up-push captured; Web1001×733@2 border/shadow sampled; fresh post-integration push motion review pending |
| third_puzzle / third | fresh root9×9, player(2,4), inner box(4,6); R U L D | baseline highlights, corners, wall connections, seams; motion/scaling | reproduced baseline, fixed native GPU wall textures/shared endpoints/inside borders; sampled255 highlights and444join checks exact; native static3sizes plus1280×900 integer scale; final DPR/motion/scaling sweep pending |
| enter / enter-exit | setup URUULURRRR then R; exit setup adds R then L | motion origin, clipping, camera crossing and nesting | actual native/Web synchronized entry/exit phases reviewed; previous-frame presentation root cause fixed0481573; sampled camera residual<3.3e-8; final integrated recursive/palette rendering review pending |
| carry / nested push | setup LLL then L | player/box continuity, nested walls | native carry-nesting-entry-20261025 proves outer2 crossing; clean frozen-production v2 actual49frames/18PNGs reaches outer2; independent image review ongoing, final integration pending |
| cycle_line / recursive | setup URRURURRDDRRRRU then U | recursive projections, nested seams/clipping | native cycle-camera-entry-20261025 proves outer5 crossing; clean production v2 actual43frames/16PNGs reaches outer5; final integrated review pending |
| infenter_first_2 / infinite enter | walk | recursive scale, ghosts, camera continuity | native exact22-input walk recorded910states/214PNGs, endpoint matches fixture; no strict infinite enter/exit occurs, so level-name credit is rejected; matching integrated Web capture/review pending |
| infexit_ref_first / infinite exit | setup DLLDRRRR then R | recursive exits, camera continuity | native pre-history accepted Exit infExitNum0 proven in hardpath-native-index; clean production v2 25frames/17PNGs exercises crossing, but starting BUMP_HALT residual t.1 is a setup mismatch; later phases separately reviewable, settled recapture pending |
| infenter_zone_v2 / generated infinity | walk then R×5 U×5 L×5 D×4 | generated zones, projection continuity | native41inputs/29accepted/1633states/376PNGs, exact fixture endpoint; final input records strict Enter infEnterNum0 into existing level7, not a generated zone; integrated Web capture/review pending |
| infenter_zone_v2 / proven generated infinity route | fresh; D D D U | actual generated-zone entry, camera/projection and history | clean production v2 47frames/18PNGs reaches outer14/wentToInfZone; epsilon/gold restored, exact camera.5/BUMP_HALT0 still lacks gray enclosure. Root missing native early open-edge pass fixed82bea3b; fresh PNG review pending |
| flip_first / horizontal flips | R D D R R | orientation, wall lighting and camera movement | native5accepted/210states/50PNGs, fixture player45 outer0(2,4) flipHtrue; integrated Web capture/review pending |
| 1by1_playerr_flip2 / boundary flip | setup RR then D; retain longer DDRURLUDDLUDDLRUDRUDLDRDULDRRRD fixture | camera-boundary flip interpolation | core previews restore board topology; clean production v2 still mirrors early and omits native focus/clone fade; renderer source investigation active. PNG readback severely perturbs motion, clean capture only5frames; separate no-PNG77frame trace median16.7ms/max183.3ms,4long frames. No timing/full visual approval; longer route pending |
| possess_first / possession | setup LDDL then L | face/phantom origin and jump phases | native proves ownership41→34/STILL.5; clean v2 actual49frames/15PNGs reproduces ownership, independent actual image review ongoing; final integration pending |
| eat_same_side / eat | setup L then L | enter/eat projection and nested rendering | native proves eaten box outer0→3; clean v2 actual50frames/18PNGs recorded; independent image review ongoing, final integration pending |
| shed_first / shed | setup RRRRU then U | moving shell, projection and animation continuity | e0bcec9 fixes native float32 exit division and strict landing axis;306measured phase checks pass unchanged1e-6. Independent15unique actual Web PNGs support sampled halt axis only; late reference frames absent. Separate goal tint root fixedce2826c awaiting final PNG |
| grid_clone / GRID | fresh R | alternate style static/motion | native hardpath index; clean production44frames/17PNGs, independent review pending |
| text_1 / TUI_COLOR | fresh U | alternate style static/motion | native hardpath index; clean production44frames/17PNGs, independent review pending |
| oldstyle_lock_two_doors / QUICK_ANIM | fresh R | fixed focus, fast motion/textures | native hardpath index; clean production44frames/14PNGs, independent review pending |
| clone_first_2 / noncanonical entry | setup DDD then D | clone clipping, camera fade | native clone-fourth-down-entry; clean production42frames/16PNGs reaches outer1; native first-half focus/clone fade implementation pending |
| third_puzzle / inspection | left click nested gold at400,190; right click after750ms | production pointer push/pop, half-second camera phases | native inspection-third-push-pop reference; production89frames/19PNGs records pointer path; independent phase/render review pending |
| static_focus_block / fixed focus | fresh | native focus47 and360.0000143px focus size | native static-focus-block-v2; production44frames/9PNGs records view47; independent actual geometry review pending |
| hub / transitions | empty save; first→second→third→enter portals; win/restart and return | camera, state reset, queued input across transitions | native two held-win repeats + natural Web sampled automatic first→second verified2d588ab; one-frame draw initialization fixedaa55139; post21af3e2 natural recapture and remaining Hub/portal transitions pending |

Walk = U R D L R R U U L D R U L L D D R U R D L U. Start positions must be recorded from authoritative snapshots, and actual action effects checked rather than assuming a sequence reaches its named mechanic.

## Input/timing matrix (apply to first three and relevant mechanic cases)

| Case | Sequence / boundary | Required result | Status |
|---|---|---|---|
| tap | press/release each direction; simultaneous U/R and U/D | one impulse, measured original timing | native delivered-mask/controller replay301updates and actual95body-pairs match; all-directions first3 natural final matrix pending |
| hold | same direction≥1s in open corridor; held history6.6s | landing + repeat delay cadence | native repeat input fixtures and Web blocked hold exercised; held-history581updates/180CanvasPNGs independently reviewed; natural corridor/pacing bounded review ongoing |
| rapid turn | direction change at1/25/50/99ms and landing | at most one queued; no mid-slide state jump | native actual queue phases and natural Web landing/application verified2d588ab; post21af3e2 queue/rapid v2 captured; literal boundary delivery remains distinct from nominal labels |
| alternating | L/R with U/D near next-frame window | immediate anyBlockMoving refresh; correct motion origin | native overlap301-update set and body bounds match; post21af3e2 natural alternating-repress captured, review pending |
| blocked | hold wall direction, change direction | repeat suppression and correct bump phases | native and controlled Web blocked/repress match; post21af3e2 natural blocked-repress captured, review pending |
| release/repress | same direction after blocked and after landing | original re-arm rules | controlled native masks/reveal/repress match; natural final integration review pending |
| undo / redo | idle and during slide, repeated presses | grouping, squish, camera sync | 12native replay cases/882controller endpoints;581exact float32 scheduler transitions; actual controlled Canvas301+581 updates reviewed with exact available body bounds; natural final history capture pending |
| restart | idle and during slide; undo restart | original instantaneous/reset rules | queued history/restart regressions and native pre/post phases; held restart interruption72actual Web updates match native; broader natural phases pending |
| transition | held/queued direction across win and portal | original reset/acceptance/camera rules | two native held-win repeats + natural Web first→second stage support; final integrated held-win/portal review pending |
| variable frame intervals |8/16.7/25/50/100ms; press inside frame | post-press delta only, correct start/landing and queue | post-press1ms clamp regression at each interval; supplied variable native deltas882controller updates; actual natural frame pacing remains separately measured |

## Findings / next experiment

### Latest bounded modules — 2026-10-25

- `daeb243`:6 style regressions fail before the source port; QUICK .6 squish, gradual camera composition/decay, native negative repeat counter, TUI .1 enter/zero bump now pass9 regressions with32 measured native QUICK phases. Full suite at that commit:52files/839tests; typecheck passed. Actual final style PNG acceptance remains open.
- `6ef63d3`: four named native recursive routes plus shine telemetry validate986PNGs/4063states and exact fixture endpoints. The literal long flip string has31inputs,19accepted/1268states/304PNGs, one clone entry, no strict infinite enter/exit;22 original-conformance cases pass including all31 native structural hashes. These counts do not imply generated-zone coverage.
- `7f18a2a`: native hinted font baselines match66 independent labels and3 actual viewport anchors;54 Move horizontal placements match,12 Undo counterexamples remain explicitly unsupported. Actual Move Sprite-atlas captures at800/1001/1280 are bounded dev evidence; immutable integrated revision review is still required.
- Native TUI `100cdad` records Inconsolata56 at800x600 with100 exact unique glyph masks and nonperturbing precision telemetry. Renderer `66dbd02` restores GRID/TUI/QUICK roots and resolves the14 TUI endpoint cells using native float/double argument evidence; all100 raw arguments/rects/colors/cursors match. Combined53files/858tests and typecheck pass. Actual production image approval remains open.
- Twelve current-observer fresh first/second/third U/D/L/R native tap captures are being recorded to supply explicit delivered-control boundaries missing from older isolated taps. Final natural input/transition, static DPR sweep, recursive image review and independent integrated approval remain pending.

1. Third level identity independently confirmed by puzzle_data labels a1/a2/a3 and portal links first→second→third→enter.
2. First experiment: capture original and untouched Web third_puzzle at rest, then compare wall UV orientation, alpha coverage, autotile topology, filters and exact geometry before choosing fix.
3. Baseline `npm test`: 20 files / 155 tests pass. No production changes at baseline.
4. Untouched Web rest capture: `evidence/web-third-before-800x600-dpr1.png`; phase captures and actual frame/event timestamps: `evidence/web-third-before-motion/trace.json`. Capture harness: `scripts/parity-capture-web.js`. At the recorded fresh load, player=(2,4), camera=(0,0,1,1), canvas800×600 and CSS800×600, DPR≈1, particles enabled, animation skipping false, move delay70ms. R U L D returns to (2,4), moveCount4. These establish Web evidence, not an original parity pass.
5. Initial original ScreenCapture attempts produced entirely black images despite a valid third_puzzle state. They are rejected as visual evidence. Investigator is repairing framebuffer capture via a visible launch of the debug installation. Native CUA capture was not approved by the runtime; no competing UI helper is used to bypass that rejection.
6. Visible debug launch and startup settling produced valid native reference `evidence/original/third-baseline-settled-20261025/`. Original repeated static ROIs are pixel-stable. Independent review establishes interior-channel tolerance1; particles, outline geometry and edge AA require separate comparisons.
7. Wall candidate:11 regressions pass, including demonstrated pre-fix failures for contrast/raw textures/sampler/mirror/snapping and exact third-level float-cancellation cases. Repaired800×600@1 white bevels match255; base/dark bevel channels differ at most1; original seam row272 and column372 are uniform. Main real Canvas capture: `evidence/web-third-after-800x600-dpr1.png`. Fractional/DPR/motion review is ongoing, not a blanket pass.
8. Native timing artifacts now cover first tap/hold/rapid/alternating/repress/history, third tap, enter/exit/nesting/flips and genuine infinity entry. Direct setup cameras need full settling; affected v1 artifacts are diagnostics only. Native animation phase conformance tests cover actual first/right and third/up measured NORMAL+BUMP_HALT frames.
9. Confirmed separate discrepancy: floor gradient .08 Web vs native effective .16 (native shader doubles alpha). Large≥256px WallBig branch and border differences remain open; full scope is not complete.


## Verified controller phase module ? 2026-10-25
- Queue acceptance/landing/next-update execution: native queue-transition-phase-summary and Web web-controller-native-phase-summary establish matched discrete ordering and reserved count; actual delivered key times are retained, not assumed equal to requested durations.
- Native queued-history source/runtime cases are covered by controller regressions: successful/blocked queued Undo, Restart/undo-restart, unsuccessful redo preserving pending, successful redo cancelling pending while preserving its recorded move count. Broader actual Web/history matrix review remains in progress.
- First-win held UP: source/runtime two isolated native repeats plus isolated actual Web show landing-based1.5s countdown, direct second_puzzle load and next-update held movement without repress. Explicit level loads still reset input; automatic loads retain controls.
- These bounded timing results do not approve the full visual/camera/input matrix. Renderer borders/tutorial and confirmed infinity/flip scene defects remain active work.


## Delivered-input verification ? sampled keyboard and held history
- 12 recorded native update replays:882 endpoints match controller level/count/coordinates/AnyMoving/animationkind/time/length; 581 additional exact float32 scheduler transitions cover acceleration, minimumspacing, failed attempts, direction switches, Undo+Redo and Restart overlap.
- Actual controlled-clock Canvas input replays:8scenarios/301updates/112PNGs; independent checker recomputes against raw native phases (not embedded expectations), exact delivered controls/state/animkind and max phase/geometry residual1.031e-7 against established1e-6. All95 available native image pairs have exact player body bounds. One last native phase has no PNG and is explicitly unverified visually.
- These controlled-clock cases do not measure natural browser frame pacing. Existing natural queue/win stage samples remain bounded results and must be rechecked at final integration.
- Concurrent render modules remain in progress: tutorial caption, recursive content/palettes, WallBig, and final multi-size/DPR/mechanic matrix. No overall approval is implied.
