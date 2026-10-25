# Bounded desktop pause camera state

2026-10-25. This module adds only src/core/pauseCamera.ts, tests/pauseCamera.test.ts and this document. It does not edit the controller, model, animation system or renderer. Main owns actual Canvas integration and the combined commit. No native injection, restart or save change was needed.

## Source and implementation

Original recovered source: F:/AssetRipper_win_x64/parabox/ExportedProject/Assets/Scripts/Assembly-CSharp.

- World.cs:1013-1020 initializes pause zoom, reverses an active unpause using 1-Pow(1-lastY,1/8), clears the unpause flag, increments pause zoom once immediately and resets controlsZoomT.
- PauseMenu.cs:298-305,324-334 increments pause zoom by delta, clamps at1, and moves controlsZoomT toward0/1 at2*delta.
- PauseMenu.cs:1056-1070 resumes Playing then calls SetCameraUnpause; Leave at563-585 loads Hub then calls SetCameraUnpause(true).
- World.cs:1852-1862 accepts unpause when (!cameraMoving || cameraUnpause) && !QUICK_ANIM && CameraMode!=Title. It sets zoomT=1-Pow(lastY,1/8); Leave sets a pending one-delta skip.
- Draw.cs:1045-1049,1146-1159 does not advance camera timing when updateCamera=false. An eligible unpause update consumes the skip before adding2*delta. Reaching zoomT1 does not clear cameraUnpause.
- Draw.cs:1905-1928 applies Util.QuadOut three times, subtracts from1 for unpause, records cameraUnpauseLastY, blends normal focus with GetFocusFractPause, multiplies by physical min-screen size and FocusBlock.SubLevel.CamZoomFactor, then uses integer screen center.
- Draw.cs:2591-2602 interpolates desktop pause focus from0.6 at16:9 to0.335 at1:1 with a clamped inverse lerp. PauseMenu.cs:1297-1305 offsets paused centerX by Lerp(0,-height*0.25,QuadInOut(controlsZoomT)).
- Draw.cs:881,922,932 clears cameraUnpause on the relevant applied offset/reset paths. Those paths leave the pending skip and lastY untouched.
- Util.cs:16-22,30-32 supplies the actual QuadInOut/QuadOut expression ordering.

Math.fround retains each original float operand/result boundary, including subtraction/multiplication within easing, delta accumulation, inverse-power input/output, inverse lerp and Lerp. The size's CamZoomFactor product remains double because Draw casts both operands to double at that stage. Triple QuadOut remains three staged calls; the algebraic eighth-power expression is not substituted. JavaScript Math.pow is rounded into a float at the original Mathf.Pow boundary; platform libm bit equality is not newly measured or universally asserted.

## API and frame integration

PauseCamera exposes snapshot(), enterPause(delta), startUnpause(options), tick(delta,options), clearCameraUnpause() and sample(options). getPauseFocusFraction and pauseCameraWeight are also exported. sample returns pauseWeight, focusFraction, size, centerX, centerY and controlsOffset, or null when the ordinary pause branch is inactive. sample represents an actual Draw and commits last renderedY; avoid calling it speculatively between simulation updates. snapshot() is detached and read-only at the TypeScript boundary.

1. Keep one instance across a regular pause, Resume and Leave-to-Hub activation. Do not recreate it on the Leave world load: the prior renderedY is required. Reset it only when the corresponding native lifecycle reinitializes these static fields.
2. On ordinary Playing Escape, call enterPause(currentNativeEquivalentDelta) once and do not also tick a paused frame for that same dispatch. World returns immediately after pause entry.
3. On subsequent paused dispatches, tick(delta,{paused:true,controlsExpanded}) before menu input actions. The caller supplies PauseMenu.LangExpandMenu's result; English keyboard/gamepad control submenus expand. Source language-dependent menu membership remains the menu/controller's responsibility.
4. Resume calls startUnpause with cameraMoving, quickAnim and cameraMode; Leave calls it after loading Hub, with leavingPuzzle:true and the new world's source-equivalent cameraMoving state. A rejected guard leaves all helper fields untouched.
5. A paused dispatch that invokes Resume or Leave still calls native Draw.Update(false), so do not tick it again as Playing. The first subsequent eligible Playing tick consumes Leave's skip. Ordinary Resume has no skip. updateCamera:false leaves pending unpause timing untouched.
6. Render the actual world using sample({width,height,paused,playing,quickAnim,cameraMode,normalFocusFraction,camZoomFactor,overrideCamera}). Width/height are physical integer framebuffer dimensions. Supply the original pre-pause normal focus fraction, including special-level changes, and the actual focus level's CamZoomFactor. A sample's size replaces the ordinary pause camera base extent, independently from the player's JUMP_OUT animation.
7. overrideCamera:true is required when earlier source branches win (trailer, Credits, TitleT<1). PerpetualZoomOut and QUICK_ANIM return null. Title is a startUnpause guard; a settled TitleT>=1 has no additional ordinary pause-branch exclusion in source. Mobile portrait and the separate PerpetualZoomOut/Title camera geometry are outside this desktop helper.
8. Call clearCameraUnpause only when the source-equivalent camera offset/reset actually applies. Preserve Draw's mode/offset guards; do not clear merely on block motion, an identity CamOffset, a rejected reset or zoomT reaching1. A null sample falls through to existing camera rendering.

## Tests and native corroboration

12 focused Vitest tests pass. npm run typecheck passes. Tests cover exact float32 literals, focus endpoints/aspect interpolation, pause entry increments, two-way interruption from last renderedY, long frames, Leave skip eligibility, ordinary Resume, Quick/Title/cameraMoving guards, flag persistence/reset, controls offsets, physical odd-size center and double CamZoomFactor composition. No pixel tolerance or fitted timing is used.

The committed hub-leave-controls-camera-native-derived.json supplies three measured native Leave runs. All show the same blue-ink bounds [268,168,531,431] at load and the next full Hub update, followed by expansion. Tests corroborate equal-first-size then growth using their native delta values. The predicate measures visible blue ink (width263), not Draw's private blockWidth (source fully paused extent approximately269.14285 at800x600). Those quantities are deliberately not equated.

Native V14 did not expose cameraUnpause, cameraUnpauseIgnoreOneDelta, zoomT, lastY or blockWidthLast. All helper state and reversal/guard assertions are source-derived, not newly measured native internal flags. Actual Canvas pause/Resume/Leave capture, interruption review and whole-scene independent approval belong to the integrating main task.

## Integrated controller and actual Canvas

Main integration preserves one PauseCamera across world replacement, clears
only its unpause flag at the equivalent load/reset boundary, and starts Leave
unpause after Hub placement. Playing Escape entry is sampled on the next
controller update and advances the pause clock once. Further paused updates
advance once; immediate menu actions execute between those updates, so no
unpause delta is consumed within the Resume/Leave action itself. The first
subsequent Playing update consumes Leave's pending skip. Root Escape cancel
also starts unpause. Keyboard/gamepad control submenus use the English source
expansion gate; localization beyond the current English menu implementation
is not claimed here.

The renderer takes source physical-pixel pause geometry independently of
newX/newY/newXS/newYS, and preserves the normal used-camera fields while this
branch runs, matching Draw.cs2022-2025's ordinary-camera-only bookkeeping.
Title/credits/Quick/perpetual branches do not use this bounded override.
Applied nonidentity ordinary camera offsets and applicable resets clear
unpause; identity offsets retain it. Existing special-camera rendering is not
reimplemented or universally approved by these changes.

All five new controller/renderer regressions fail before integration: three
missing state/lifecycle cases and two wrong focus rectangles atDPR1/2. They
pass after integration. An additional applied-offset/reset test and retained
used-camera assertion cover the source guard boundaries.

Actual evidence: `evidence/web-pause-camera-after-dev` contains held-right
(214rAF/64PNGs), held-down(214rAF/57PNGs), and resume-interruption(81rAF/29PNGs),
with exact input schedules, pause snapshots, measured blue raster report,
per-file hashes and native paired image. Both held runs' first full Hub rAF
has blue ink bounds[268,168,531,431], exactly the native first full update's
predicate result. The next Web frames expand naturally. Native next delta
19.5053ms and Web16.7/16.8ms differ, so their later pixel bounds are not judged
at equal frame indices or requested wall-clock deadlines. No Web load-dispatch
PNG is claimed: the first recorded Hub rAF already follows the full update;
load count0 is event metadata, while Right first-rAF count1 is the reservation.
Down remains unreserved throughout flight then reenters after landing.

Full workspace verification after these integration tests:67files/1032tests,
typecheck and production build pass. The interruption Canvas demonstrates
both reversal directions, with source-based helper tests; a matching new
native interruption image run and final integrated independent approval are
still not supplied by this module. No whole-scene pixel-perfect claim follows.
