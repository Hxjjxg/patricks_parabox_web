# Accepted terminal old-cell phantom route

Date: 2026-10-25. This bounded source/core investigation owns only this
new record and new tests/terminalPhantomRoute.test.ts. It does not modify
production code or use native/browser UI, injection, staging or commits.
Native runtime and PNG evidence for this route are unavailable. The core
and draw-queue results below are not Canvas or whole-image approval.

## Observation and bounded search

Native Draw.cs6030–6047 draws a non-face terminal phantom with DrawWall,
then DrawFace only when Possessable||IsPlayer. The current Web phantom
branch instead sends !block.subLevel directly to an unconditional
drawFace call, with no terminal wall submission. The question was whether
an actual accepted movement could reach this branch, rather than merely
a synthetic source-contract phantom.

Only three directly named bundled candidates were inspected:
infenter_poswall_setup, poswall_first and exit_possess_setup. In
poswall_first, the hand-derived RRRRDDDDUULLLR and RRRRDDDDUULLLLR
attempts possess the terminal wall on input8 but do not cross a level
boundary: the green box is pushed and entry from the blocked side fails.
An initial infenter_poswall_setup R / URL attempt also does not cross;
its special references are not ordinary occupancy. Correcting that
hand-derived route to LLLR succeeds. Search stops at this counterexample.

## Actual accepted route

Load unchanged bundled infenter_poswall_setup, then apply L L L R.
Settle both world and camera animations twice with deltaTime1 between
commands; leave the final accepted input at T0. The regression uses
updateWorldAnimations with quickAnim=false, handleActionFloor returning
false and deterministic random=.5, plus updateCameraAnimation.

| Input | Accepted move count | Player | Outer level | Cell |
| --- | ---: | ---: | ---: | --- |
| initial | 0 | 16 | 0 | (4,4) |
| L | 1 | 16 | 0 | (3,4) |
| L | 2 | 16 | 0 | (2,4) |
| L | 3 | 16 | 1 | (4,2) |
| R | 4 | 16 | 0 | (2,1) |

All four commands are accepted and none possesses another block. Block16
is the same IsPlayer terminal block throughout (subLevel=null). Input2
also pushes reference48 from (2,4) to (1,4). Input3 is an ordinary Enter
with infEnterNum=-1, projection scales5, offsets(3,0) and duration.5.
Input4 is an ordinary Exit with infExitNum=-1, projection scales
.20000000298023224, offsets(-.6000000014901161,0), duration.5 and no Nudge.

The ordinary-exit constructor integrated by main creates exactly one
old-cell phantom in level1: block16, xpos4/ypos2, face=false, exiting=true,
exitedFrom=block27, exitingDX1/exitingDY0, xTo1/yTo0, animLength.5.
Level1 has references27,48,55 after initialization. Normal draw suppresses
the canonical27 occurrence but admits existing noncanonical48. Grid also
admits the canonical occurrence; QuickAnim suppresses the copy. This is
an actually admitted representation, not a universally suppressed one.

## Source rules and discriminators

Original source directory:
F:/AssetRipper_win_x64/parabox/ExportedProject/Assets/Scripts/Assembly-CSharp.

- Movement.cs291–301 allows a terminal player only when no earlier chain
  block would violate its guard. This route satisfies that guard.
- Movement.cs302 onward handles a nonplayer terminal wall only through
  inner push, requiring an eligible enclosing exit representation and
  excluding preview. That branch moves the enclosing representation,
  sets Nudge and returns; it does not reach the normal terminal constructor.
- Movement.cs1019 rejects exits whose chosen exit block has no OuterLevel.
- Movement.cs1149 returns the Nudge path before phantom constructors.
- Movement.cs1261–1283 is the ordinary-exit old-cell constructor used here;
  this is not the infinite-enter constructor at1285–1315.
- Draw.cs5946–6077 supplies canonical suppression except Grid, source size
  and cull gates, simple-slide deformation and temporary parent clamp.
- Draw.cs6030–6047 submits DrawWall for terminal non-face copies and only
  an eligible DrawFace, restores the temporary clamp and continues without
  child backing. Draw.cs5787 supplies the parent ticket's wall color.
- DrawWall2993 onward uses the block's live cached WallTileIndex.
  Movement.MoveBlock1134–1135 refreshes old/new terminal neighborhoods;
  Autotile.cs72–89 computes from current OuterLevel/xpos/ypos. Thus block16
  uses current level0/(2,1) for its tile while its copy stays at old level1
  geometry with reference48 tint.

DrawFace3952's first boolean is facePhantom. The native terminal call
passes ticket.flipH in that slot and false for flipH and cloneFade. This
route is unflipped, so its expected facePhantom=false and flipH=false.
The test does not reinterpret that unusual source signature.

## Real drawScenePass regression

The new test contains no synthetic phantom injection. It advances the
actual fourth move to T=.125 of duration.5 (phase p=.25), updating both
world and camera animation. It invokes real drawScenePass/drawLevel with
root ticket rectangle(154,54,492,492), retaining current depth, cull and
minimum-size gates. GPU drawing primitives are recorded. This fixed root
ticket is a bounded draw-queue test, not an actual animated camera image.

For the actual reference48 backing rectangle, let c=parent.width/5 and
q=quadParabola(p). Source simple-slide geometry is:

    x = parent.x + c*(4+p-.05*q)
    y = parent.y + c*(2+.1*q)
    width = c*(1+.1*q)
    height = c*(1-.2*q)

Its right edge crosses the parent boundary while part remains visible.
The regression requires one wall and one eligible face at the full source
rectangle, both clipped to the reference48 parent rectangle. It also
requires the wall shader layer with parent tint wallTint(reference48,c/600),
the moved player's current level0 autotile context, and wall before face.
No phase fitting, cutoff reduction or tolerance widening is involved.

Observed run: npx vitest run tests/terminalPhantomRoute.test.ts
--reporter=dot produces2 passed and1 failed. The real movement and draw
admission tests pass. The rendering test fails at its first wall assertion:
expected one submission at the source rectangle, received zero. This is
the expected missing-wall discriminator; assertions after it are required
source contracts and have not passed yet. Repeated npx tsc --noEmit passes.
Main owns the renderer repair and final green validation.

## Scope and evidence boundary

The current21-level visual matrix was checked for Wall token3/4 player
or possessable flags: first_puzzle, second_puzzle, third_puzzle, enter,
carry, cycle_line, infenter_first_2, infexit_ref_first, infenter_zone_v2,
flip_first, 1by1_playerr_flip2, possess_first, eat_same_side, shed_first,
clone_first_2, static_focus_block, iii, grid_clone, text_1,
oldstyle_lock_two_doors and hub. None supplies an initial terminal player
or terminal possession target. The scoped possess_first ownership41→34
is container possession. Preview dummy movement returns early; generated
zone walls do not add terminal player/possessable flags. These facts bound
this source eligibility scan; they do not assert exhaustive game coverage.

infenter_poswall_setup is a genuine bundled source/core counterexample
outside that21-level matrix. It has no retained native runtime/UI/PNG
capture. Separately, actual Zone41 block59 is container59/subLevel11 filled
by wall60, so this terminal route does not change the corrected attribution
of Zone41's missing shrinking container copy. The previous synthetic wall60
discriminator remains source-only. No existing visual approval is expanded.

## Reproducibility hashes

- infenter_poswall_setup.txt SHA256:
  c9e9c14576ad67ce5c861a9e86250aee3c973bd004272449cfc0d9ad8ab3de2f
- poswall_first.txt SHA256:
  65bc9c396a853787f7a2166e076fec9f28cdc0808ff9b8669734a24b1f499bf6
- exit_possess_setup.txt SHA256:
  5d91f1e9846dc629deee0edede860d6ff809cea140cf5b1211cc6cfc2173dde5
- The sorted21-source [{level,sha256}] manifest, compact JSON UTF8 SHA256:
  148ea51767c55739d51f3e06d42df967ae90f55bd06fc3137ae99e87c09daa49
- Movement.cs SHA256:
  e2b13b05d8bf8e62b3f101de12754d7b8a3908dfbb8cbf1fec5a66da2bfe9377
- Draw.cs SHA256:
  e26bd1a20c0db16bf15f3961e368aa2f947880399b7361cc6ad9bbe862b012bd
- Autotile.cs SHA256:
  a0d43cab4a26ff1f5d4efc232f3083a9fe625d08a6f9d4f1eef87fff3c52aa3c

## Main integration and bounded verification

Main restored native non-face terminal branch: current logical outerlevel for autotile; new parent-tint wall layer at actual submission order; existing geometry.clip applied to wall and eligible direct normal-face; parent container restored. Both isolated synthetic source contract and actual accepted LLLR route assertions now pass unchanged, including all assertions previously unreachable after the zero-wall failure.44focused tests/typecheck pass.

Actual browser before/after each61rAF/16PNG are retained under evidence/web-infenter-phantom-after-dev/terminal-before and terminal-after with source hashes. Complete ordered Web before/after endpoints equal. terminal-web-before-after.png reports actual body/camera times independently. Main viewed quarter and late full Canvas: early old-copy occurrence is offscreen during zoom, so no early visibility credit; late after contains the filled small yellow old-copy wall at rightedge of green reference where before has an unbacked face. This is actual Web output, not original visual approval: native runtime/PNG for this route remains unavailable.

Full integrated npm test now has no exclusions:75files/1141testspass, typecheck/buildpass (Vite chunk advisory only). Includes19unintegrated Hub state mechanism tests, which are not Hub integration credit. terminal-verification-source.json confirms all five actual capture production hashes unchanged after checks. Independent/final immutable revision review remains required.
