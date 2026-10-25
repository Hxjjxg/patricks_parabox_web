# Source-derived Hub connection geometry

Date:2026-10-25. The pure helper and tests use the source mapping committed
as `f68f629`, especially `hub-portal-rendering-native-findings.md` and the
SHA-pinned `evidence/original/hub-portal-rendering-native-derived.json`.
No core/GameRenderer edit, new native capture, browser action or Canvas
acceptance was performed for this helper module.

## Observations and method

The paired images already show missing Web Hub links. Three possible
explanations were separated: absent source connection data, wrong geometric
routing, and incorrect layer/compositing order. The authoritative source
gives independently testable data/routing stages; matching those stages
does not by itself settle final image composition. No pathfinder, fitted
offset, synthetic adjacent-puzzle connector or color compensation is used.

Source identities are retained in the original fixture: Floor.cs SHA256
`6782e66144d781b6044d3604856b49f6481655c37ce33c8a979dac8b3411fa49`,
LoadLevel.cs `7de74bb1364a9b7178d912b8eb0439178cf89234c305fda87cedfaa182f10f6d`,
Draw.cs `e26bd1a20c0db16bf15f3961e368aa2f947880399b7361cc6ad9bbe862b012bd`.

## Read-only helper APIs

`src/render/hubPortalRendering.ts` exports:

- `captureHubUnlockWalls(blocks)` retains coordinates, owning level,
  unlocker scene and original Block reference. Keep these records before
  progression removes walls, or pass retained original Block references.
- `buildHubConnections(floors,walls,{links?,nexusUnlocked?})` builds native
  puzzle, shortcut, root and end-game connection records without mutating
  the input model. The default links are the existing original resource.
- `computeHubUnlockLineShape(level,from,dx,dy,unlockWall?,walls?)` returns
  the exact route shape and destination SinglePortalExit field patches.
  It does not write those patches into gameplay state.
- `hubConnectionWaypoints(line)` returns continuous local diagnostic
  waypoints. Rendering uses the source's own segment order instead.
- `hubConnectionRectangles(line,{x,y,cellWidth,cellHeight},screenshotting?,litPass?)`
  returns the integer FullWhiteTex strips. x/y are the source cell center.
  Its final litPass parameter is deliberately unused, matching native IL.
- `hubConnectionLineColor(parent.color,active,parentWidth,parentHeight,screenHeight,hueOffset?)`
  applies native float HSV arithmetic and the existing measured GUI
  half-color-to-byte transfer.

Geometry inputs and returned rectangles use native physical pixel units.
For a CSS-coordinate renderer at non-unit resolution, the caller must scale
the geometry/screen dimensions to native pixel units before these integer
operations, then convert returned rectangles back to CSS coordinates. No
new arbitrary-DPR visual claim follows from the unit-resolution fixtures.

An explicit `HubUnlockWall.open` overrides removed-wall inference. This is
needed if a later native-style unlocking animation keeps a logically open
wall attached. The current model removes open walls immediately; retaining
the Block reference preserves the path even after removal. Capturing only
the already-filtered `world.blocks` would permanently lose that record.

## Literal source behavior

Floor.ComputeUnlockLineShape (Floor.cs218-341) first selects Straight for
either zero axis. Otherwise it tries the L route beginning with the larger
absolute delta, horizontal on ties, then the other L. Source and destination
endpoints are excluded; the L corner is checked. Floors and ordinary
non-unlock walls block; nested blocks do not. Relevant unlock-wall position
records block ordinary puzzle links but are ignored for shortcut-wall links.
If both L routes fail, the immediately adjacent vertical cell chooses the
one-cell-offset HorizFirstS/VertFirstS fallback. This is not a search for a
globally shortest unobstructed route.

LoadLevel.cs1401-1512 emits non-immediate puzzle links with hard destinations
first, core destinations second; lit comes from the destination's unlocked
state and thick from hard==0. Immediate links emit no line. Shortcut links
find the first nested block beside the wall in left/down/up/right order.
Root-area exceptions and the iii/Reception special paths are retained.

Draw.cs4176-4278 converts deltas with y inversion, casts endpoints to float,
uses thick/thin coefficients `.32f`/`.12f`, splits integer thickness into
sm/sp, and extends every segment endpoint by those amounts. Literal float32
coefficients matter: a100px cell produces31px thick or11px thin strips,
not nominal32/12. SetDrawRect truncates both endpoints toward zero.
Negative origins, minimum1px thickness, segment order and `.57f` end-game
offsets are covered by tests. Reception's y shift uses cell width, as source
does, even for rectangular cells.

The final draw-pass argument is truly unused (original managed IL fixture
records zero references). The source compares `(line.lit || ScreenshottingBlocks)`
with `line.lit`, so ordinary lines render in both passes, and screenshot
mode skips unlit lines. No intended active/inactive filtering is invented.

## Intro route and color checks

The parsed original Hub and existing progression fields yield exactly:

| Source | Destination | Shape | Local waypoints |
| --- | --- | --- | --- |
| third_puzzle | enter | HorizFirstL | (4,6),(2,6),(2,4) |
| lock_door | Area_Enter reference | VertFirstS | (7,4),(7,3),(5,3),(5,1) |

After first/second/third wins, the first path is lit and the shortcut dark.
After all nine Intro wins, the shortcut wall is absent from the grid but its
retained connection remains and is lit. These results are independently
compared with source-derived fixture waypoints, not generated expected data.

Intro's source parent HSV is(.6,.8,1). For a492x492 parent and screenHeight600,
the source color helper gives active `0x3c70be` (60,112,190), inactive
`0x0a1c34` (10,28,52). Offline inspection of the existing native frame
`intro-third-win-held-native-v1-20261025/frame-0096.png` finds396 pixels
of the active color in `[285,250,330,259)` and28 inactive-color pixels at
x482..495/y367..368. Most of the visible dark path farther down instead
has RGB(13,35,66). This residual is preserved as a composition question;
the helper does not fit a brighter inactive tint to the screenshot.

## Integration order and flip behavior

Draw.cs5620-5685 first enables/extends the enclosing board clamp, computes
parent line colors, and draws all connection floors in two complete passes.
Only afterward it handles nonportal/locked/won floors, then unlocked-unsolved
portals. DrawOrEnqueueFloor.cs6449-6481 queues portal bodies in qStill and
markers separately, but draws portal shadows immediately. Thus portal
shadows overlay already-drawn connection endpoints. Particles and block
shadows follow. Markers dequeue after moving objects and before possessable
and face queues (Draw.cs2548-2565).

With ticket.flipH, the caller reflects only the source floor x index used
for childX. DrawPortalLines itself does not negate dx, mirror shapes or read
its xpos/ypos parameters. The helper preserves this source oddity: callers
may mirror the supplied source center but must not synthesize a mirrored
delta. Separate natural Hub rendering validation is still required.

## Verification and bounds

`tests/hubPortalConnections.test.ts`:26 tests pass; TypeScript typecheck
passes. Checks include the pinned original fixture, actual parsed Intro
layout/progression, open-wall persistence, read-only inputs, route priority
and blockers, root/end-game branches, float coefficients, negative endpoint
truncation, duplicate passes, screenshot gating and source color values.

The helper does not enqueue Pixi graphics, apply model exit patches, own
world registry lifecycle, or prove browser/native pixel parity. Main owns
those integration changes and Canvas captures. Arbitrary DPR composition,
inactive-path color residuals, moving shadows and native marker phase remain
separate checks; no visual approval is inferred from these pure tests.

## Marker and shadow helper extension

The same owned module additionally exports:

- `advanceHubPortalFlashTime(previous,deltaSeconds)` and
  `hubPortalMarkerPhase(portalFlashT)` preserve the global float32 clock and
  Util.QuadOscillate arithmetic.
- `hubPortalMarkerRect(floor,{centerX,centerY,width,height},portalFlashT,{screenshottingBlocks?,unlocking?,clamp?})`
  returns the source marker rectangle or null when gated/clipped.
- `hubPortalShadowRect(floor,geometry,screenWidth,screenHeight,options?)`
  returns the source shadow rectangle. Options expose flipH, staticWidth,
  staticHeight, receptionPerformanceHack, devAchShrink, screenshottingBlocks,
  hubBorderThicknessHack and an already-computed inherited clamp.
- `hubPortalClampRect(rect)` applies EnableClamp's float32/floor endpoint
  conversion; `clipHubPortalRect(rect,clamp?)` applies DrawTexture intersection.
  An already-stacked native clamp may have fractional boundaries and should
  be passed directly rather than unconditionally floored again.

Draw.cs3677-3685 requires Unlocked&&!Won&&!ScreenshottingBlocks and suppresses
hard2 portals while World.unlocking. It uses a white FullWhiteTex square;
there is no marker sprite. Its center is `(centerX-width*.42f,
centerY-height*.42f)`, while both nominal side dimensions use the width,
lerped from `.25f` to `.42f` using the common global phase. Marker rendering
uses the static cell ticket even when the portal preview itself celebrates.

The phase is `Util.QuadOscillate(portalFlashT*.5f)`, a2-second oscillation
with piecewise QuadInOut easing (Util.cs16-22,35-42). Draw.Update adds
Time.deltaTime to the private static float clock at1007; no per-portal
random phase or reset exists in this path. The caller must retain one clock
across portals/world changes and update it once per native-equivalent draw
update, not independently while drawing each portal. The helper preserves
float32 frame accumulation; ten `.1` increments produce1.0000001192092896.
The existing native capture does not export that private phase, so its
white-square size cannot be accepted from a newly chosen Web phase.

Float operation order matters. Marker arguments/size are floats, but
SetDrawRect accepts their promoted doubles before adding endpoint bounds.
For center(100,80), size40x20, the sampled clocks0/.5/1 yield integer
rectangles `(78,66,10,10)`, `(76,64,13,14)`, `(74,63,17,16)`. The nominal
square can rasterize with width and height differing by1 due to independent
signed endpoint truncation; no cosmetic square rounding is substituted.

DrawPortalShadow (3491-3512) uses PortalSize==1 and a black FullWhiteTex
shadow. Its dimensions remain the cell dimensions. Offset is twice
ComputeBorderThickness(staticWidth,staticHeight), horizontally negated by
flipH and always downward vertically. Only unlocked-unsolved portal centers
are snapped first to `floor(float(center))+.25f`. Won and locked centers
retain double precision. Border thickness uses min(staticWidth,staticHeight)/30,
a screenMin*.00508f cap, source multiplier priorities, clamp and ties-to-even
Mathf.Round. Reception performance mode omits shadows only for Priority,
Extrude and Push. QuickAnim's separate .25 shadow constant is not referenced
by DrawPortalShadow; this method always passes the normal shadowColor.

The source shadowColor is raw GUI RGBA(0,0,0,.15f), Draw.cs312. Exports retain
that raw alpha as `hubPortalShadowGuiAlpha`, plus black RGB and the existing
GUI-transfer opacity estimate `hubPortalShadowAlpha` (approximately.3).
The latter is renderer transfer behavior, not an independently captured
opacity measurement in this module. Markers use Color.white and opaque
white. Raw draw rectangles are clipped against the inherited parent clamp,
not automatically against their portal cell. Queued marker tickets retain
the caller's ticket clamp; immediate portal shadows use the active enclosing
board clamp. Both can be supplied explicitly by the renderer.

Marker/shadow source tests add24 cases, for50 combined Hub helper tests;
the focused suites and TypeScript typecheck pass. They cover phase landmarks,
float accumulation, source gates, rectangular cells, endpoint precision,
inherited clipping, shadow-center snapping, horizontal flip, static-cell
thickness, ties-to-even rounding and source cap/performance flags. These
remain pure helper tests, not native/Web visual acceptance.

Final shared-workspace regression at this handoff:62 test files/982 tests
pass, and `npm run build` succeeds. Vite's existing large-chunk advisory
remains; no new build error or type error is left by this helper module.

## Remaining inactive-color discrimination

A read-only Mono.Cecil check of the actual debug Assembly-CSharp.dll
SHA256 `cfcb386a623cf6c86c225163c0f90b0e1409357fcdb39222dd446acecb7240bc`
confirms the LineColor constants `.4,-.4,.8,.85,.9,.25` and HSVToRGBGUI's
RGB/2, alpha/2 operations. The inactive multiplier is .25 in the actual
assembly too; there is no demonstrated AssetRipper version mismatch.
The existing capture/end-state does not record parent HSV or the final
LineColor RGBA sent to Graphics.DrawTexture. A parent-value change alone
would also scale active color, already matched exactly, so it cannot simply
justify adjusting only the inactive value.

Black portal shadows overlay connection endpoints, but a black overlay
alone cannot brighten an opaque(10,28,52) into(13,35,66). Source gives no
lighter shadow tint or alternative active/inactive pass filter. The actual
low-color GUI transfer, alpha packing and composite layering remain open.
A bounded native discriminator should record parent HSV and both resulting
LineColor RGBA values, then draw those exact colors over a uniform background
with/without the source shadow. No fitted inactive brightness is introduced.

## Integrated actual Canvas follow-up

Main integrated retained unlock-wall records before progression removal, source
connections on world changes, and the two literal line passes. Portal shadows
remain in the parent backing pass; portal bodies use priority-zero still tickets,
then all corner markers precede faces. The persistent float32 portal clock is
shared across floors rather than restarted per portal. Actual captures are
`evidence/web-hub-connections-after-dev/third-only-win` (12rAF/3PNGs, lines only)
and `evidence/web-hub-layers-after-dev/third-only-win` (133rAF/12PNGs, final queues).

The final actual start frame has active-link RGB(60,112,190) at(300,253),
unshadowed inactive RGB(10,28,52) at(490,375), and shadowed RGB(7,20,37)
at(490,367), matching the fresh native baseline. The follow-up logging-only
native probe committed as `d0b3f30` resolves the older bright residual: unchanged
line RGBA is overlaid by the ordinary late blue level particle. Its actual raw
RGBA(.099999994,.259999931,.5,.035) predicts both measured bright colors under
the existing transfer. See `hub-line-color-native-findings.md`; the exact old
run particle rectangle remains qualified inference. No brightness adjustment
was made. Particle clock/coverage must be aligned for exact whole-frame judging.

Renderer tests cover literal doubled dispatch, colors, physical pixel snapping,
retained shortcut records and actual shadow/body/marker/face queue order.
These additions do not establish full Hub visual parity: shortcut fractions,
pause camera/labels and final immutable integrated review are still open.
