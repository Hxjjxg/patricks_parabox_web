# Native player outline on the retained infinite-entry walk

Date: 2026-10-25. Investigation uses debug-hypothesis with this owned record
instead of shared DEBUG.md. No browser/native input or production edit occurs.

## Observations

Actual paired image web-long-routes-after-dev/infenter_first_2/phase-pairs-03.png
shows a white native player outline and dark Web outline at native frame0871
and endpoint frame0909. Parent reports ordered blocks and structural flags
match: finishesSatisfied=true,buttonsSatisfied=false,winning=false. The
frame0871 pair has unequal primary animation times; the endpoint has settled
camera but retained BUMP_HALT times. Those phase differences remain separate
from the demonstrated persistent outline tint difference.

## Hypotheses

1. Local goal coverage drives white independently of winning/global flags.
   Supports: original DrawBlockBorder tests Block.CoveringButton, while the
   existing Web helper chooses locked/infinity/base HSV only. Test: inspect
   CoveringButton's exact player/floor predicate and actual endpoint floor.
2. A clock/focus effect changes outline color. Supports: infinity borders
   oscillate and recursive focus has separate passes. Conflicts: player stays
   in ordinary outer0 and the observed outline is neutral white. Test: inspect
   special-border predicates and retained player/source context.
3. Layer order exposes a white backdrop around an unchanged dark outline.
   Supports: floors and deferred borders draw in separate passes. Conflicts:
   source has a direct white border override. Test: establish actual local
   coverage and inspect border dispatch before altering any geometry/order.

## Experiments and conclusion

All three hypotheses were tested without altering production code.

H1 is confirmed. Original Block.CoveringButton (Block.cs618-628) returns true
only when both SubLevel and OuterLevel exist, the floor at the block's current
logical x/y exists, and either IsPlayer&&PlayerButton or !IsPlayer&&Button.
It does not read World.Winning, ButtonsSatisfied or FinishesSatisfied.
The original infenter_first_2 source has Floor5,5 PlayerButton in outer0.
The actual22-input native fixture and parsed current engine both end player
in outer0,(5,5),sub1, while finishes=true/buttons=false/winning=false. Thus
local coverage is true. It already becomes true when the final Up accepts
its logical destination, before the body finishes sliding there.

H2 is rejected as the root of this white outline. The actual player's outer0
is not an infinity zone, and isInfinityBorder(player)=false in the parsed
endpoint. Source DrawBlockBorder applies clock-dependent yellow only to the
special infinity flag, then eligible goal white overrides that tint anyway.
No clock, camera phase or focus condition appears in the local white test.

H3 is rejected as the root of the dark-versus-white strips. DrawBlockBorder
explicitly sets Color.white and submits those border strips; the existing
Web helper itself emits dark strips in an isolated graphics recorder for
the same parsed endpoint. Its source color selection has only locked,
infinity and base HSV branches. No layer, geometry, alpha or overlap change
is required to reproduce the missing white branch.

## Exact source order and raw color

Draw.cs3312-3445 uses this order:

1. Return if !BordersEnabled&&!CoveringButton; current source default
   BordersEnabled=true (Draw.cs264).
2. Start from block.borderColor.
3. If special infinity-border flag, replace with clock-dependent yellow
   HSVToRGBGUI. The existing isInfinityBorder helper supplies this predicate.
4. If !World.ScreenshottingBlocks&&CoveringButton&&
   (!World.InHub()||World.ButtonsSatisfied)&&
   (DrawStyle!=GRID||depth!=0), replace with Color.white (3335-3338).
5. Eligible hubShortcutWon can subsequently replace with white and enable
   the thickness hack (3339-3343). This is a separate existing-helper gap,
   not needed to explain this ordinary player endpoint.
6. Locked replaces all previous color choices with Color.red (3344-3347).
7. QUICK_ANIM returns for non-infinity border flags (3348-3350).
8. Compute source thickness and use the existing solid/infinity strip paths.

For the confirmed goal outline, source Color.white is raw RGBA(1,1,1,1),
not HSVToRGBGUI's half-color white, a pale fitted tint or a new glow opacity.
FullWhiteTex is passed through DrawTexture to the actual Graphics.DrawTexture
overload with instance.Mat (1427-1474). Its clamp only intersects geometry
and source UVs; it does not change the supplied white color. The source's
opaque white texture path yields RGB255,255,255 in the retained native PNGs.
The Web strip fill for that source override should therefore be0xffffff,
with existing strip geometry and opacity retained.

Read-only native texel inspection in the player region x400..509/y190..329
finds exactly400 white pixels in frame-0871.png, bounds x432..475/y242..301,
and416 in frame-0909.png, bounds x427..480/y218..271. Endpoint outer two rows
each contain54 white pixels, as do its two full-height white columns per side.
These are observed native texels, not a fitted border width. Existing source
thickness logic already produces two pixels for this cell; this investigation
does not change it.

## Minimal integration change

Root lies in existing src/render/borderRendering.ts. No new
playerOutlineRendering.ts is created. Add a final optional drawBlockBorder
context carrying screenshottingBlocks,inHub,buttonsSatisfied,drawStyle,depth.
Tests describe this boundary through a widened test-only function type;
before integration, JavaScript ignores that tenth argument. A minimal local
predicate and tint branch inside the existing helper are:

    const floor = block.outerLevel?.getFloor(block.x, block.y);
    const covering = Boolean(block.subLevel && floor &&
      (block.isPlayer ? floor.type === FloorType.PlayerButton : floor.type === FloorType.Button));
    const whiteGoal = !context.screenshottingBlocks && covering &&
      (!context.inHub || context.buttonsSatisfied) &&
      (context.drawStyle !== DrawStyle.Grid || (context.depth ?? 0) !== 0);

Preserve base/infinity calculation and select locked?red:whiteGoal?white:
infinity?existingInfinity:existingBase. This is the source precedence for
the confirmed gap. Goal white overrides infinity color but does not disable
infinity's full four-strip geometry. Locked red overrides both.

GameRenderer must pass the actual current world Hub/button/style flags and
the original ticket-equivalent depth to both drawBlockBorder call sites.
Use depth0 for a GRID root and the existing incremented depth for nested
levels; do not replace it with a constant. Screenshot mode must remain an
explicit draw flag if that source mode is supported later. Ordinary
inHub=false must allow local goal white even when buttonsSatisfied=false.
Do not drive this branch from world.winning or global finishesSatisfied.

The ordinary early open-edge DrawBlock pass also has its own covering-goal
white-with-alpha.2 rule (3193-3197); that broader pass is distinct from this
filled-player solid outline. This handoff changes neither early open edges,
Hub shortcut thickness, QUICK dispatch nor existing draw order.

## Reproduced failing regression

NEW tests/playerOutlineRendering.test.ts calls the existing drawBlockBorder
and replays every command from the real infenter_first_2-walk.json fixture.
Before any production patch:15 tests run,8 fail and7 pass; typecheck passes.
The actual route emits0x200208 on all four strips rather than0xffffff. The
small isolated synthetic ordinary-player controls emit0x200010; tests compute
fallback color from their own current block color instead of assuming those
two palettes are numerically identical.

Failures cover actual parsed endpoint, both correct local floor/occupant
pairs, Hub ButtonsSatisfied=true, GRID depth1, goal-white over infinity,
clock independence and logical destination during movement. Passing negative
controls cover wrong local floor for player/nonplayer, another goal elsewhere,
screenshot suppression, Hub ButtonsSatisfied=false, GRID depth0 and locked
red precedence. Existing border thickness/strips remain the tested mechanics.
The infinity test checks identical geometry with/without the eligible white
override; its screenshot-suppressed control retains source yellow0xa69600.

Main owns the existing-helper/GameRenderer production patch, subsequent green
test run, actual Canvas recapture and commit. This agent has not edited those
production files, any existing helper, or shared DEBUG.md.

## Phase differences still open

The Up image pair is not phase-equal: native frame0871 NORMAL T=.050701,
length.1, drawYOffset=.492990017, scales.800039351/1.09998035; paired Web
NORMAL T=.06429999999701977, length.1, drawYOffset=.35700000002980237,
scales.8163591999931813/1.0918204000034095. Both camera phases are1. The
player body offset/squash difference follows these unequal phases and is
not accepted as repaired by changing the outline tint.

At the endpoint, native BUMP_HALT T=.235931888 and Web bumpHalt
T=.23289999999999783 both have length.22, zero offsets, unit scales,
AnyBlockMoving=false and camera phase1. The persistent white/dark border is
therefore a separate confirmed color-branch gap. Particle clocks/coverage,
other images and any unsynchronized phases remain individually unverified.

Native pruned player index25 and Web runtime id26 refer to their own
registries; spatial/source-state correspondence establishes this match,
not an assumption that the numeric IDs must equal.

## Provenance

Original source root is the retained AssetRipper Assembly-CSharp export.
SHA256 values:

- Draw.cs: e26bd1a20c0db16bf15f3961e368aa2f947880399b7361cc6ad9bbe862b012bd
- Block.cs: b93af533734b8d4fe5457263f11ba80f8857361fc9c80cc3cf541c7e6fccb0d9
- src/assets/levels/infenter_first_2.txt:08c4b0d09efed742aedb6259848bf7f407be7e18b108f9563857db5537f1dcab
- tests/fixtures/original/infenter_first_2-walk.json:55dbcd4e1512d998a994fb2a7c1012d52aab051a5dcf75bc1bc8f29cf04d7659
- Before-fix borderRendering.ts:251ad3aef34566cea8afbbc978716b872975bcb50b16dbcb6a164ffd8f652d5e

Native frames live in evidence/original/
infenter-first-walk-native-v1-20261025:

- frame-0871.png:4fd3ad5b8ac451cd8e297b072de877e20b8562c5d6c3dca61c91d05bfdb05498
- frame-0909.png:93f0be11e03e32f16e5b03536f886968a356932a8b6f00241817179079a73775

Actual Web evidence is evidence/web-long-routes-after-dev/infenter_first_2:

- phase-pairs-03.png:9ccc4f495ffc8ed5adc1cfc159a75072caa7ae053d7cf9d48d4f882101d3c0da
- trace.json:b98b94cf9f0d51cea260299223272c0774e985505e8596d5d834c94a2d14aee9

No whole-frame equality, fitted offset/tint/overlap, tolerance, unseen visual
approval or clock normalization is inferred from these source/regression checks.
# Main integration and bounded actual verification

Main patched the existing borderRendering.ts helper and passed actual Hub,
ButtonsSatisfied, DrawStyle and native ticket depth from both GameRenderer
drawBlockBorder callsites. Two real drawLevel integration tests additionally
cover the Hub false/true and GRID depth0/1 gates. All29 focused helper,
integration and existing border cases pass. No new rendering helper, border
thickness, geometry, timing or tolerance was introduced.

Actual unchanged22-input recapture is retained in
evidence/web-player-outline-after-dev/infenter_first_2 (886rAF/310PNG), with
source hashes, all Canvas PNGs and exact complete71-block endpoint. The
comparison.json and player-outline-native-before-after.png use native0909,
old captured endpoint and new actual endpoint. At unscaledROI
[420,210,490,282], purewhite counts are416/0/416; native/new masks are exactly
equal. Main directly viewed the full new Canvas and crop plate. Both terminal
transforms are offset0/scale1/camera1 despite different halt times; no complete
particle/face-clock or whole-scene approval is inferred.

The first typecheck found exactOptionalPropertyTypes rejecting nullable-world
optional values. Explicit false/Normal defaults fix that typing at the two
callsites; actual captured worlds already supplied real values. Final source
typecheck/build pass; immutable integrated recapture and independent review
remain separate requirements.

Frozen final source verification is retained in verification-test.log and
verification-source.json under the actual after-dev evidence:70testfiles/
1078tests pass with identical before/after production source hashes. The
22original-conformance cases, final typecheck and production build also pass.
The optional original-sweep flag found no additional fixture cases in this
checkout; it is not credited as extra original coverage. Only the existing
Vite large-chunk advisory remains.

