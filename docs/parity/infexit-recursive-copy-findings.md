# Infinite-exit lower-right recursive copy investigation

Date: 2026-10-25. This source/image audit follows debug-hypothesis in this
owned record, with no shared DEBUG.md, browser/native input or production edit.

## Observations

Independent review reports a retained native lower-right orange recursive
copy immediately right of the main pink player during infexit_ref_first's
proven crossing, missing from actual immutable-v4 Web images. The upper-left
orange copy near the infinity symbol is already present. The actual setup
is DLLDRRRR then Right; native and Web both accept move8->9. Source v5 uses
the same relevant projection, according to the parent. Full native BUMP_HALT
coverage beyond T=.0167644 is unavailable; captions are context-confounded.

## Hypotheses

1. A repeated representation ticket is omitted or takes the wrong ancestry.
   Supports: one orange copy exists but its counterpart is absent. Test:
   compare exact source ticket/representation traversal with existing queues
   and actual committed/transient block relationships at the crossing.
2. Source-valid clipping or minimum draw size removes this copy in Web.
   Supports: recursive copies have small dimensions and inherited clamps.
   Test: derive its source ticket geometry/clip and native policy bounds;
   distinguish a missing ticket from an actually rejected one.
3. A phase/context mismatch makes differently placed content look absent.
   Supports: retained Web body phases are not exact native timestamps and
   camera names can label already-complete phases. Test: inspect actual
   body/camera values and native bracketing PNGs at all cited moments.
4. Existing global geometry/effect ordering hides a correctly queued copy.
   Supports: Still/Moving/Phantom contexts and overlay masks are separate.
   Test: trace bounded renderer ticket dispatch before changing any layer.

## Source proof

Audited Web HEAD: 2d094198b1180a4a78dfaa2bf834835d3f29a113 (frozen v5
source before this task's new helper). The task does not alter production
movement, model or renderer files.

Native Movement.ResolveMove, Movement.cs1217–1283, scans only the resolved
block's attempt chain. It records the first matching dx/dy, whether any step
is Exit, and the last Exit infExitNum that is not -1. For any exit with an
old outer level that has at least one representation, it creates one Phantom:

- block remains the actual moving Block object.
- outerLevel/xpos/ypos are the old outer level and old logical coordinates,
  sampled before UndoManager.DoRedo moves the block.
- exitedFrom starts as oldOuter.GetExitBlock(), overridden with
  oldOuter.GetInfExitBlock(lastInfExitNum) when a tier exists. A null lookup
  stays null; the native code does not substitute the ordinary exit.
- exiting=true; exitingDX/DY use ResolveMove's final direction.
- If final dx is nonzero, xTo=first matching move.dx. If final dy is nonzero,
  yTo=-first matching move.dy. This distinction preserves flipped chains.
- animLength=CurrentTurn.AnimLength. Defaults remain animT/x/y=0, face=false,
  xScale/yScale and all scale endpoints=1. Native Phantom.UpdateAnim line
  52 onward linearly advances these fields, removing at animT>=animLength.

Web resolveMove has the same projection/turn registration and camera work,
but completely omits this constructor. Global search finds only possession
and hub-transition phantom registration.

### Actual path discriminator

A read-only Vite server module replay, with no browser or native input,
settled DLLDRRRR and resolved Right. The real move chain for block24 is:

| step | old outer/cell | target outer/cell | dx/dy | infExitNum |
| --- | --- | --- | --- | --- |
| Slide | 0/(6,1) | 0/(7,1) | 1/0 | -1 |
| Exit | 0/(6,1) | 0/(2,4) | 1/0 | 0 |

Old outer0 references are [24,23], so native's representation gate passes.
Its ordinary exit is24; infExitBlock(0) is23. Native therefore registers
old-cell phantom(block24,outer0,6,1,exitedFrom23,xTo1,length.5).
Web after accepted move9 instead has zero phantoms in both levels. Its
current block24 is correctly at(2,4), EnterExit, .5s, with start offsets
(-.5714285746,.2857142985) and scales(.1428571492,.1428571492). Player21
correctly slides from(5,1) to(6,1), Normal, .5s. The missing object is thus
the old representation, not the already-present upper-left current block.

## Ticket, size, clipping and phase discriminator

Native Draw.cs5946–6077 traverses subLevel.phantoms. It skips QUICK_ANIM,
exitedFrom==ticket.block except GRID, and applicable maxDepth gates. In
the actual root ticket view24, exitedFrom23 differs, so the copy survives.
Native tests the full phantom scale against minDrawSize, computes its old
cell, performs conservative3x screen cull and existing clamp rejection,
then applies simple-slide geometry because exiting=true. The backing
ticket enters qPhant with depth+1, phantom=true, ordered parents prepended
with view24, and its clamp stacked with the source board.

At800x600/DPR1, normal minDrawSize is1px. The root board is
(154,54,492,492), with c=492/7. This is a root-cell-sized copy, far above
the cutoff; it does not require additional recursion. With p=bodyT/.5
and q=QuadParabola(global Draw.AnimT/AnimLength), unrounded screen geometry is:

    x = 154 + c * (6 + p - .05*q)
    y =  54 + c * (5 + .10*q)
    w = c * (1 + .1*q)
    h = c * (1 - .2*q)

The clip is the original board, so its visible right edge is646.
At the observed crossing global Draw phase equals body phase. The camera
position is stationary/newCamT=1, but global cameraAnimT/Length advances;
these are distinct clocks. Existing cameraTransitionPhase correctly uses
the latter. Calling the stationary camera phase1 does not justify dropping
or unsquashing this body representation.

| actual body T | unrounded rect x,y,w,h | retained width to x646 |
| --- | --- | --- |
| Web .1381 | 592.317,411.049,75.906,59.045 | 53.683 |
| Web .2547 | 608.005,412.455,77.312,56.234 | 37.995 |
| Web .3880 | 627.813,410.316,75.173,60.512 | 18.187 |
| Native .14784351 | 593.569,411.284,76.141,58.576 | 52.431 |

Native integer quad snapping and border details follow this ticket; the
numbers above deliberately do not fit screenshot edges. A source-contract
copy supplied only inside the test already reaches the existing real
GameRenderer.drawLevel priority2 queue with the expected board clip. That
positive discriminator passes while the same queue after actual movement
contains zero old-cell tickets. Thus the primary cause is creation, before
render cull, clipping, queue dispatch, or masking.

## Hypothesis outcomes

1. Missing representation: confirmed. Actual movement has no old-cell
   phantom; native's exact gate and constructor require one.
2. Valid min-size/screen/clamp rejection: rejected for this root copy.
   Its >70px initial cell passes1px cutoff and intersects the492px board.
   Existing renderer accepts the source-contract representation unchanged.
3. Phase/context mismatch: cannot account for this absence. Phase affects
   the pose and retained width, but all three saved body moments require
   visible old-cell geometry. Captions and exact native/Web timestamps
   remain context-confounded, so whole-frame equality is not claimed.
4. Queue/layer loss: rejected as the cause of a nonexistent model object.
   The bounded queue discriminator proves admission, not final Canvas
   compositing or every descendant's order. Native tickets also propagate
   phantom=true to descendants; this audit does not certify all recursive
   descendant order or replace the actual post-integration visual review.

## New helper, regression and integration contract

New src/core/exitPhantoms.ts contains pure createExitPhantom. It returns one
native constructor result or null without registering, moving, or mutating
the input. Integrate once in actual resolveMove before History applies
the destination coordinates. Existing infExitPreviewMode's early return
must remain ahead of it, so dry-run previews cannot leak objects. Register
the returned object's old outerLevel.phantoms. Do not register from
History.applyTurn: redo deliberately does not rebuild movement phantoms.

New tests/infexitRecursiveCopy.test.ts has20 cases. Before integration:
13 pass and7 fail, all7 on absent committed ordinary-exit phantoms. Tests
cover exact actual path creation, three observed body-time queue entries,
native old-position/direction/tier defaults, one result for repeated exit
steps, ordinary exit versus plain enter, blocked move, singular possession
face copy, expiration, undo/redo, and next impulse cleanup. The two
unchanged suites possessFaceTransfer and infExitPreviews pass as well:
37 total tests,30 pass/7 fail. Typecheck passes. An initial recorder fixture
needed an irrelevant GPU shadowTexture crop stub; the final failing
results contain no harness errors and preserve actual cull/queue logic.

Native Impulse clears phantoms at the start (Movement154), and again after
an unsuccessful attempt (Movement208). Web already clears at the start;
its failure/cancel branch currently lacks the second source clear. No
failed-path leak is proven here; matching the explicit native cleanup
is a bounded adjacent integration decision. Native UndoManager.DoUndo
always clears, and DoRedo(doAnim=false) clears without reconstructing.
Web History.applyTurn already has those history semantics.

### Separate adjacent omission

Movement.cs1285–1315 also creates a shrinking old-cell phantom when the
same block's chain has Enter with infEnterNum!=-1, with half-cell offset
sign selected from projection and inverted for infEaten. Web lacks that
path too. The new exit helper does not implement it. It requires a
separate observed reproduction/source regression rather than expanding
this root-copy fix silently.

## Evidence identity and limits

- Native: evidence/original/infexit-proven-crossing-20261025/frame-0007.png,
  body .14784351/.5; SHA256
  11f0dcf53fff77aceaf26d732bed0d920b70daddbfd6885ff26721a2dc1f665b.
- Web immutable-v4: evidence/web-production-candidate-v4/infexit/
  motion-0001-normal-0.25.png, actual body .1381/.5; SHA256
  03ab0c9bda105bc4779c683a19384ac20a06dc9a71c7909d4812676b5ebe30d5.
- Corresponding v4 .5 and .75 PNG hashes:
  af166740c9533f75f039f99a9a2597648448220f81edd6ac1de12746350c0e46;
  a93d73d155afab7d4d654712b21a0b1d2c8ed78622e7b8056191e0a47b3f7705.
- Native Movement.cs SHA256:
  e2b13b05d8bf8e62b3f101de12754d7b8a3908dfbb8cbf1fec5a66da2bfe9377.
- Native Draw.cs SHA256:
  e26bd1a20c0db16bf15f3961e368aa2f947880399b7361cc6ad9bbe862b012bd.
- Native Phantom.cs SHA256:
  dd33c278bc52273606768753c0379d3d4a0b4eb30105e753ad3377a7cc0a836b.
- Native UndoManager.cs SHA256:
  b99bd5424c0d3e6e71f9cbca284ce010c31c4acdd74223e51c6650938cae716a.

No browser/native input, production integration, staging or commit was
performed by this task. The source and queue evidence proves an omitted
required representation, not actual Canvas parity. Main owns integration,
green regression verification, immutable-v6 capture and independent visual
review. Frozen-v4/v5 images cannot be relabeled as post-fix evidence.
No arbitrary depth, clip overlap, weakened size threshold, fitted
offset/tint, or blanket acceptance is used.

## Main integration and actual Canvas verification

Main integrated createExitPhantom in resolveMove after camera/flip work and
before History changes logical coordinates. Existing preview/nudge/portal
early returns remain ahead of registration. No renderer geometry, depth,
cull, masks, color or timing was changed. The four initial post-integration
test failures were test setup errors: three queue geometry cases needed
the real global updateCameraAnimation clock as well as body updates; the
next-Up case incorrectly assumed a blocked move. Correcting those fixtures
preserves the cleanup assertions and all numerical expectations.37 focused
exit/possession/preview tests pass, as does typecheck.

Actual development capture: evidence/web-infexit-phantom-after-dev/infexit,
44rAF/16PNG, unchanged DLLDRRRR plus timed Right; complete trace includes
source SHA256 provenance. Main inspected full Canvas plus
exit-phantom-time-brackets.png. The lower-right orange copy now exists
inside the original board clip beside the pink player at all three saved
body times. visual-phase-brackets.json retains exact PNG hashes and native
time brackets: Web .1319, .2652, .4651 vs native
.129288808–.14784351, .2619641–.2817519, .4529539–.473009.
The nominal .75 capture was delayed to actual phase .9302 and is not
credited as exact .75 evidence. Old-v4 timestamps are shown independently,
not substituted for current phases. No interpolation, fitted offset or
whole-frame pixel equality is claimed. Independent recheck is pending.

Exit-scoped verification:71files/1098tests pass with only the separately owned, unintegrated infEnterPhantoms suite explicitly excluded. The preceding all-suite red run is retained unchanged. Typecheck and production build pass (Vite chunk-size advisory only). verification-source.json proves all five capture production/test anchor hashes unchanged across this run and equal actual capture provenance. Separate terminal-wall exploratory test was released afterward and is not claimed covered by this green run. Final integrated all-suite verification and immutable review remain required.
